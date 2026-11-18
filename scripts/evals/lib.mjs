// Shared pieces of the eval runner: reading the prompt tables, mapping MCP tools to function
// tools, and the mechanical scoring. No network and no model here, so it is unit tested.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { traceNumbers } from "../trace-numbers.mjs";

const ROOT = resolve(import.meta.dirname, "../..");

/** The prompt sets. `idPattern` picks the rows of a file that belong to the set. */
export const SETS = {
  domestic: { file: "docs/use-case-comparison/prompts.md", idPattern: /^D\d+$/, verticals: ["courses-domestic"] },
  international: { file: "docs/use-case-comparison/prompts.md", idPattern: /^I\d+$/, verticals: ["cricos"] },
  health: { file: "docs/use-case-comparison/health-prompts.md", idPattern: /^H\d+$/, verticals: ["health-cover"] },
  // Needs lender data from the CDR sync, which CI does not load; run it where that data exists.
  "home-loans": { file: "docs/home-loan-evaluation/prompts.md", idPattern: /^H\d+$/, verticals: ["home-loans"] },
};
/** What a run covers when no set is named: the sets whose data CI can load from the repo and fixtures. */
export const DEFAULT_SETS = ["domestic", "international", "health"];

/** Rows of a markdown table `| Id | Prompt | Expected tools | A grounded answer must |`. */
export function parsePromptTable(markdown, idPattern) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || !idPattern.test(cells[0])) continue;
    const tools = cells[2] === "(none)" ? [] : cells[2].split(",").map((t) => t.trim()).filter(Boolean);
    rows.push({ id: cells[0], prompt: cells[1], expectedTools: tools, must: cells[3] });
  }
  return rows;
}

export function loadSet(name) {
  const set = SETS[name];
  if (!set) throw new Error(`Unknown set "${name}" (known: ${Object.keys(SETS).join(", ")})`);
  const rows = parsePromptTable(readFileSync(resolve(ROOT, set.file), "utf8"), set.idPattern);
  return rows.map((r) => ({ ...r, set: name, key: `${name}:${r.id}` }));
}

/** An MCP tool as an OpenAI function tool. */
export function toFunctionTool(tool) {
  return {
    type: "function",
    function: { name: tool.name, description: tool.description ?? "", parameters: tool.inputSchema ?? { type: "object", properties: {} } },
  };
}

/** Wording the project never wants from a host. Flags go to a person to judge; they do not fail a run alone. */
export const BANNED = [
  { name: "best", re: /\bbest\b/i },
  { name: "recommended", re: /\brecommend(?:ed|s|ation)?\b/i },
  { name: "odds of entry", re: /\b(?:you(?:'ll| will) (?:get|be accepted)|guaranteed (?:a )?(?:place|entry)|chance of (?:getting|entry))\b/i },
  { name: "aggregate as ATAR", re: /aggregate of \d+[^.]*\bATAR (?:of|is|equals) \d/i },
];

export function bannedWording(answer) {
  return BANNED.filter((b) => b.re.test(answer)).map((b) => ({
    name: b.name,
    quote: (answer.match(b.re) ?? [""])[0],
  }));
}

/** Mechanical score of one run. Pass: expected tools called (none called when none expected) and every figure traced. */
export function scoreRun({ row, toolCalls, toolResults, answer, error }) {
  const called = [...new Set(toolCalls.map((c) => c.name))];
  const missingTools = row.expectedTools.filter((t) => !called.includes(t));
  const unexpectedTools = row.expectedTools.length === 0 ? called : [];
  const untraced = traceNumbers({ prompt: row.prompt, toolResults, answer }).map((f) => f.raw);
  const banned = bannedWording(answer);
  const noAnswer = !answer.trim();
  const pass = !error && !noAnswer && missingTools.length === 0 && unexpectedTools.length === 0 && untraced.length === 0;
  return { key: row.key, pass, error: error ?? null, noAnswer, called, missingTools, unexpectedTools, untraced, banned };
}

export function summarise(scores) {
  const n = scores.length;
  const count = (f) => scores.filter(f).length;
  return {
    runs: n,
    passed: count((s) => s.pass),
    errors: count((s) => s.error),
    missingTools: count((s) => s.missingTools.length > 0),
    unexpectedTools: count((s) => s.unexpectedTools.length > 0),
    withUntraced: count((s) => s.untraced.length > 0),
    untracedFigures: scores.reduce((a, s) => a + s.untraced.length, 0),
    withBanned: count((s) => s.banned.length > 0),
  };
}

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The markdown report: summary, then one row per run with what a person must read the answer for. */
export function renderReport({ label, model, startedAt, runs }) {
  const sum = summarise(runs.map((r) => r.score));
  const out = [];
  out.push(`## Evals ${startedAt}${label ? `: ${label}` : ""}`, "", `Model: \`${model}\`. Sets are our own prompts, not real user questions; a run of this size gives a direction, not statistics.`, "");
  out.push("| Runs | Passed | Errors | Missing tools | Unexpected tools | Runs with untraced figures | Untraced figures | Runs with flagged wording |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  out.push(`| ${sum.runs} | ${sum.passed} | ${sum.errors} | ${sum.missingTools} | ${sum.unexpectedTools} | ${sum.withUntraced} | ${sum.untracedFigures} | ${sum.withBanned} |`, "");
  out.push("Pass means the expected tools were called (none when none were expected) and every figure in the answer appears in the prompt or a tool result. Flagged wording and the \"must\" column need a person.", "");
  out.push("| Run | Result | Tools called | Missing | Untraced figures | Flagged wording | A grounded answer must |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const { row, score: s, n } of runs) {
    const result = s.error ? `ERROR ${s.error}` : s.noAnswer ? "NO ANSWER" : s.pass ? "PASS" : "FAIL";
    const missing = [...s.missingTools, ...s.unexpectedTools.map((t) => `unexpected ${t}`)].join(", ");
    const banned = s.banned.map((b) => `${b.name}: "${b.quote}"`).join("; ");
    out.push(`| ${row.key}${n > 1 ? `#${n}` : ""} | ${cell(result)} | ${cell(s.called.join(", ") || "-")} | ${cell(missing || "-")} | ${cell(s.untraced.join(", ") || "-")} | ${cell(banned || "-")} | ${cell(row.must)} |`);
  }
  return out.join("\n") + "\n";
}
