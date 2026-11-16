// Writes (or with --check, verifies) the generated skill reference from src/guidance/shared.ts.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TARGET = resolve(ROOT, "plugin/skills/ask-righto-grounding/references/rules.md");

const out = await build({
  entryPoints: [resolve(ROOT, "src/guidance/shared.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "warning",
});
const code = out.outputFiles[0].text;
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const expected = mod.renderRulesReference();

if (process.argv.includes("--check")) {
  const actual = readFileSync(TARGET, "utf8");
  if (actual !== expected) {
    console.error("rules.md is stale: run `npm run guidance:generate`");
    process.exit(1);
  }
} else {
  writeFileSync(TARGET, expected);
}
