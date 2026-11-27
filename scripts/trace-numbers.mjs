// Number-trace check: flags figures in a host answer that appear in neither the recorded tool
// results nor the user's prompt. Deliberately simple and strict: it errs toward flagging.
//
// Usage: node scripts/trace-numbers.mjs run.json
//   run.json: { "prompt": "...", "toolResults": ["..."], "answer": "..." }
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Canonical form: commas removed, trailing zeros after a decimal point trimmed. */
export function canon(raw) {
  const s = raw.replace(/,/g, "");
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function figures(text, { skipListMarkers = false } = {}) {
  const out = [];
  const body = skipListMarkers ? text.replace(/^\s*\d+[.)]\s+/gm, "") : text;
  for (const m of body.matchAll(NUMBER)) out.push({ raw: m[0], value: canon(m[0]), index: m.index });
  return out;
}

/**
 * A fraction in a tool result (lenders publish rates as 0.0599) may be shown as a percentage (5.99). Done on the
 * digits, not with floats, so it is exact: the decimal point moves two places. Only `0.` values with up to six decimals.
 */
function asPercent(raw) {
  const m = /^0\.(\d{1,6})$/.exec(raw);
  if (!m) return undefined;
  const d = m[1].padEnd(2, "0");
  return canon(`${d.slice(0, 2).replace(/^0+(?=\d)/, "")}.${d.slice(2) || "0"}`);
}

/** Returns the figures in `answer` that are absent from the prompt and every tool result. */
export function traceNumbers({ prompt = "", toolResults = [], answer = "" }) {
  const fromResults = toolResults.flatMap((t) => figures(t));
  const percents = fromResults.map((f) => asPercent(f.raw)).filter(Boolean);
  const known = new Set([...figures(prompt), ...fromResults].map((f) => f.value).concat(percents));
  return figures(answer, { skipListMarkers: true }).filter((f) => !known.has(f.value));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const untraced = traceNumbers(run);
  for (const f of untraced) console.log(`UNTRACED ${f.raw} at ${f.index}`);
  console.log(untraced.length === 0 ? "OK: every figure traces to the prompt or a tool result" : `${untraced.length} untraced figure(s)`);
  process.exit(untraced.length === 0 ? 0 : 1);
}
