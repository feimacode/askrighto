// Writes (or with --check, verifies) the generated skill reference from src/guidance/shared.ts.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TARGETS = [
  { src: "src/guidance/shared.ts", fn: "renderRulesReference", out: "plugin/skills/ask-righto-grounding/references/rules.md" },
  { src: "src/homeloans/guidance.ts", fn: "renderHomeLoanRulesReference", out: "plugin-internal/skills/home-loan-comparison/references/rules.md" },
];
let stale = false;
for (const t of TARGETS) {
  const out = await build({ entryPoints: [resolve(ROOT, t.src)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "warning" });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  const expected = mod[t.fn]();
  const target = resolve(ROOT, t.out);
  if (process.argv.includes("--check")) {
    let actual = "";
    try { actual = readFileSync(target, "utf8"); } catch { /* missing */ }
    if (actual !== expected) { console.error(`${t.out} is stale: run \`npm run guidance:generate\``); stale = true; }
  } else writeFileSync(target, expected);
}
if (stale) process.exit(1);
