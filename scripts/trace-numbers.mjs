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

/** "0.0599" -> "5.99", by moving the decimal point (no floating point). */
export function asPercent(fraction) {
  const d = fraction.slice(2).padEnd(2, "0");
  return canon(`${d.slice(0, 2).replace(/^0+(?=\d)/, "")}.${d.slice(2)}`);
}

function figures(text, { skipListMarkers = false } = {}) {
  const out = [];
  const body = skipListMarkers ? text.replace(/^\s*\d+[.)]\s+/gm, "") : text;
  for (const m of body.matchAll(NUMBER)) out.push({ raw: m[0], value: canon(m[0]), index: m.index });
  return out;
}

/** Returns the figures in `answer` that are absent from the prompt and every tool result. */
export function traceNumbers({ prompt = "", toolResults = [], answer = "" }) {
  const known = new Set([...figures(prompt), ...toolResults.flatMap((t) => figures(t))].map((f) => f.value));
  // CDR rates are fractions (0.0599 is 5.99%): a fraction in a tool result also traces its percentage.
  for (const t of toolResults) for (const f of figures(t)) if (/^0\.\d+$/.test(f.value)) known.add(asPercent(f.value));
  return figures(answer, { skipListMarkers: true }).filter((f) => !known.has(f.value));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const untraced = traceNumbers(run);
  for (const f of untraced) console.log(`UNTRACED ${f.raw} at ${f.index}`);
  console.log(untraced.length === 0 ? "OK: every figure traces to the prompt or a tool result" : `${untraced.length} untraced figure(s)`);
  process.exit(untraced.length === 0 ? 0 : 1);
}
