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
  // Reads lenders live through the proxy tools (add-cdr-home-loan-proxy): no database, but outbound internet is needed.
  "home-loans": { file: "docs/home-loan-evaluation/prompts.md", idPattern: /^H\d+$/, verticals: ["home-loans"] },
  // Runs against synthetic plan fixtures and the synthetic benchmark file (scripts/evals/load-energy-fixtures.mjs).
  energy: { file: "docs/energy-evaluation/prompts.md", idPattern: /^E\d+$/, verticals: ["energy"] },
};
/** What a run covers when no set is named: the sets whose data CI can load from the repo and fixtures. */
export const DEFAULT_SETS = ["domestic", "international", "health"];

/**
 * The optional fifth column: `;`-separated mechanical checks, written as plain phrases so a table cell needs no
 * escaping (no `|`, `;` or `/` inside a phrase; `/` separates alternatives).
 *   arg:TOOL.KEY=VALUE   some call to TOOL had argument KEY equal to VALUE
 *   says:A/B             the answer contains at least one of the phrases
 *   never:A/B            the answer contains none of the phrases
 *   result:A/B           some tool result contains at least one of the phrases
 * Phrases match case-insensitively. A cell of `-` or nothing means no checks.
 */
export function parseChecks(cell) {
  if (!cell || cell === "-") return [];
  return cell
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf(":");
      const kind = c.slice(0, i);
      const body = c.slice(i + 1).trim();
      if (kind === "arg") {
        const m = /^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)=(.+)$/.exec(body);
        if (!m) throw new Error(`bad arg check: ${c}`);
        return { kind, tool: m[1], key: m[2], value: m[3].trim(), raw: c };
      }
      if (!["says", "never", "result"].includes(kind)) throw new Error(`unknown check kind: ${c}`);
      return { kind, phrases: body.split("/").map((p) => p.trim().toLowerCase()).filter(Boolean), raw: c };
    });
}

/** The raw text of the checks that failed for one run. */
export function failedChecks(checks, { toolCalls, toolResults, answer }) {
  const ans = (answer ?? "").toLowerCase();
  const res = (toolResults ?? []).map((r) => String(r).toLowerCase());
  return (checks ?? [])
    .filter((c) => {
      if (c.kind === "arg") return !toolCalls.some((t) => t.name === c.tool && String(t.args?.[c.key]) === c.value);
      if (c.kind === "says") return !c.phrases.some((p) => ans.includes(p));
      if (c.kind === "never") return c.phrases.some((p) => ans.includes(p));
      return !c.phrases.some((p) => res.some((r) => r.includes(p)));
    })
    .map((c) => c.raw);
}

/** Rows of a markdown table `| Id | Prompt | Expected tools | A grounded answer must |`. */
export function parsePromptTable(markdown, idPattern) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || !idPattern.test(cells[0])) continue;
    const tools = cells[2] === "(none)" ? [] : cells[2].split(",").map((t) => t.trim()).filter(Boolean);
    rows.push({ id: cells[0], prompt: cells[1], expectedTools: tools, must: cells[3], checks: parseChecks(cells[4]) });
  }
  return rows;
}

const NMI_A = "6407000123"; // invented, as are the serials below
const NMI_B = "6407000999";
function nem12Day(date, suffix, nmi, serial) {
  const half = Array.from({ length: 48 }, (_, i) => (i >= 32 && i < 40 ? "0.500" : "0.100"));
  return { head: `200,${nmi},${suffix},1,${suffix},,${serial},KWH,30,`, row: `300,${date},${half.join(",")},A,,,${date}120000,` };
}
/** Small synthetic files the prompts can name: three days of NEM12 data, a two-NMI file and a NEM13 file. Invented identifiers. */
export const SAMPLE_FILES = {
  "NEM12:3days": () => {
    const days = ["20260105", "20260106", "20260107"].map((d) => nem12Day(d, "E1", NMI_A, "SER-0099"));
    return [days[0].head, ...days.map((d) => d.row)].join("\n");
  },
  "NEM12:2nmi": () => {
    const a = nem12Day("20260105", "E1", NMI_A, "SER-0099");
    const b = nem12Day("20260105", "E1", NMI_B, "SER-0098");
    return [a.head, a.row, b.head, b.row].join("\n");
  },
  NEM13: () => ["100,NEM13,202611191200,UNITEDP,RETAILX", `250,${NMI_A},E1,1,E1,,SER-0099,20260101,0,10,20,A,,,20260201,0,10,20,A`, "900"].join("\n"),
};
/** Replaces {{NEM12:3days}}-style placeholders in a prompt with the sample file. */
export function expandPrompt(prompt) {
  return prompt.replace(/\{\{([A-Za-z0-9:]+)\}\}/g, (m, name) => (SAMPLE_FILES[name] ? SAMPLE_FILES[name]() : m)).replace(/\\n/g, "\n");
}

export function loadSet(name) {
  const set = SETS[name];
  if (!set) throw new Error(`Unknown set "${name}" (known: ${Object.keys(SETS).join(", ")})`);
  const rows = parsePromptTable(readFileSync(resolve(ROOT, set.file), "utf8"), set.idPattern);
  return rows.map((r) => ({ ...r, prompt: expandPrompt(r.prompt), set: name, key: `${name}:${r.id}` }));
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
  const checks = failedChecks(row.checks, { toolCalls, toolResults, answer });
  const pass = !error && !noAnswer && missingTools.length === 0 && unexpectedTools.length === 0 && untraced.length === 0 && checks.length === 0;
  return { key: row.key, pass, error: error ?? null, noAnswer, called, missingTools, unexpectedTools, untraced, banned, failedChecks: checks };
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
    withFailedChecks: count((s) => (s.failedChecks ?? []).length > 0),
  };
}

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The markdown report: summary, then one row per run with what a person must read the answer for. */
export function renderReport({ label, model, startedAt, runs }) {
  const sum = summarise(runs.map((r) => r.score));
  const out = [];
  out.push(`## Evals ${startedAt}${label ? `: ${label}` : ""}`, "", `Model: \`${model}\`. Sets are our own prompts, not real user questions; a run of this size gives a direction, not statistics.`, "");
  out.push("| Runs | Passed | Errors | Missing tools | Unexpected tools | Runs with untraced figures | Untraced figures | Runs with flagged wording | Runs with failed checks |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  out.push(`| ${sum.runs} | ${sum.passed} | ${sum.errors} | ${sum.missingTools} | ${sum.unexpectedTools} | ${sum.withUntraced} | ${sum.untracedFigures} | ${sum.withBanned} | ${sum.withFailedChecks} |`, "");
  out.push("Pass means the expected tools were called (none when none were expected), every figure in the answer appears in the prompt or a tool result, and the row's mechanical checks (the prompt tables' optional fifth column) hold. Flagged wording and the \"must\" column need a person.", "");
  out.push("| Run | Result | Tools called | Missing | Untraced figures | Failed checks | Flagged wording | A grounded answer must |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const { row, score: s, n } of runs) {
    const result = s.error ? `ERROR ${s.error}` : s.noAnswer ? "NO ANSWER" : s.pass ? "PASS" : "FAIL";
    const missing = [...s.missingTools, ...s.unexpectedTools.map((t) => `unexpected ${t}`)].join(", ");
    const banned = s.banned.map((b) => `${b.name}: "${b.quote}"`).join("; ");
    out.push(`| ${row.key}${n > 1 ? `#${n}` : ""} | ${cell(result)} | ${cell(s.called.join(", ") || "-")} | ${cell(missing || "-")} | ${cell(s.untraced.join(", ") || "-")} | ${cell((s.failedChecks ?? []).join("; ") || "-")} | ${cell(banned || "-")} | ${cell(row.must)} |`);
  }
  return out.join("\n") + "\n";
}
