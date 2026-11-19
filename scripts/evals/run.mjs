// Runs the prompt sets from docs/ through a model against the Ask Righto tools and scores each
// answer mechanically (expected tools, untraced figures, banned wording).
//
//   npm run evals -- --set domestic,health --only D01,H07 --repeat 2 --label "before X"
//   npm run evals -- --dry-run
//
// Model endpoint, only from the environment (no defaults): EVALS_BASE_URL, EVALS_MODEL, EVALS_API_KEY.
// Server: started from dist/ on a free port with every vertical loaded and an internal token, unless
// EVALS_MCP_URL names one already running. DATABASE_URL (a throwaway database) gives it data.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  DEFAULT_SETS,
  SETS,
  expandPrompt,
  loadSet,
  renderReport,
  scoreRun,
  summarise,
  toFunctionTool,
} from "./lib.mjs";
import { checkEndpoint, runPrompt } from "./apiAgent.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const { values: opt } = parseArgs({
  options: {
    set: { type: "string", default: DEFAULT_SETS.join(",") },
    only: { type: "string" },
    repeat: { type: "string", default: "1" },
    label: { type: "string" },
    "max-turns": { type: "string", default: "8" },
    "dry-run": { type: "boolean", default: false },
  },
});

const sets =
  opt.set === "all"
    ? Object.keys(SETS)
    : opt.set
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
const only =
  opt.only && opt.only !== "all"
    ? new Set(opt.only.split(",").map((s) => s.trim().toUpperCase()))
    : null;
const repeat = Math.max(1, Number.parseInt(opt.repeat, 10) || 1);
const rows = sets
  .flatMap(loadSet)
  .map((r) => (opt["dry-run"] ? r : { ...r, prompt: expandPrompt(r.prompt) }))
  .filter((r) => !only || only.has(r.id) || only.has(r.key.toUpperCase()));
if (rows.length === 0) throw new Error("No prompts match --set / --only");

console.log(
  `${rows.length} prompt(s) x ${repeat} run(s) from: ${sets.join(", ")}`,
);
if (opt["dry-run"]) {
  for (const r of rows)
    console.log(
      `${r.key}\t${r.expectedTools.join(",") || "(none)"}\t${r.prompt}`,
    );
  process.exit(0);
}

for (const v of ["EVALS_BASE_URL", "EVALS_MODEL", "EVALS_API_KEY"]) {
  if (!process.env[v]) throw new Error(`${v} is not set`);
}
const {
  EVALS_BASE_URL: baseUrl,
  EVALS_MODEL: model,
  EVALS_API_KEY: apiKey,
} = process.env;

const { Client, StreamableHTTPClientTransport } =
  await import("@modelcontextprotocol/client");

function freePort() {
  return new Promise((ok, bad) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
    s.on("error", bad);
  });
}

try {
  await checkEndpoint({ baseUrl, apiKey, model });
  console.log(`Model endpoint answers for "${model}"`);
} catch (e) {
  console.error(
    `::error::The model endpoint check failed. Check EVALS_BASE_URL (the URL that /chat/completions is added to), EVALS_MODEL and EVALS_API_KEY. ${e instanceof Error ? e.message : e}`,
  );
  process.exit(1);
}

let server;
let mcpUrl = process.env.EVALS_MCP_URL;
if (!mcpUrl) {
  const port = await freePort();
  const token = randomBytes(32).toString("base64url");
  const env = {};
  for (const [k, v] of Object.entries(process.env))
    if (!/^EVALS_API_KEY$/.test(k) && v !== undefined) env[k] = v;
  server = spawn(
    process.execPath,
    [resolve(ROOT, "dist/askrighto.js"), "--http"],
    {
      env: {
        ...env,
        PORT: String(port),
        HOST: "127.0.0.1",
        ASKRIGHTO_VERTICALS: [
          ...new Set(["energy", ...sets.flatMap((s) => SETS[s].verticals)]),
        ].join(","),
        ASKRIGHTO_PUBLIC_VERTICALS: "energy",
        ASKRIGHTO_INTERNAL_TOKEN: token,
        ASKRIGHTO_RATE_LIMIT: "100000",
        ASKRIGHTO_LOG: "off",
      },
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  await new Promise((ok, bad) => {
    server.stdout.on("data", (d) => String(d).includes("listening") && ok());
    server.on("exit", (c) =>
      bad(
        new Error(
          `The server exited early with ${c}; run "npm run build" first`,
        ),
      ),
    );
  });
  mcpUrl = `http://127.0.0.1:${port}/mcp-internal/${token}`;
}

const client = new Client({ name: "ask-righto-evals", version: "0" });
await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
const { tools } = await client.listTools();
const fnTools = tools.map(toFunctionTool);
console.log(`Connected: ${tools.length} tools`);

const startedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const runDir = resolve(ROOT, "evals/runs", startedAt.replace(/[:]/g, "-"));
mkdirSync(runDir, { recursive: true });

const runs = [];
let exitCode = 0;
let errorStreak = 0;
try {
  outer: for (const row of rows) {
    for (let n = 1; n <= repeat; n++) {
      let result = { answer: "", toolCalls: [], toolResults: [] };
      let error;
      try {
        result = await runPrompt({
          baseUrl,
          apiKey,
          model,
          prompt: row.prompt,
          tools: fnTools,
          instructions: client.getInstructions(),
          maxTurns: Number.parseInt(opt["max-turns"], 10) || 8,
          callTool: (name, args) => client.callTool({ name, arguments: args }),
        });
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      const score = scoreRun({ row, ...result, error });
      runs.push({ row, n: repeat > 1 ? n : 1, score });
      writeFileSync(
        resolve(runDir, `${row.key.replace(":", "-")}-${n}.json`),
        JSON.stringify(
          {
            prompt: row.prompt,
            toolResults: result.toolResults,
            answer: result.answer,
            toolCalls: result.toolCalls,
            score,
          },
          null,
          2,
        ),
      );
      console.log(
        `${score.pass ? "PASS" : "FAIL"} ${row.key}#${n}${error ? ` (${error})` : ""}`,
      );
      errorStreak = error ? errorStreak + 1 : 0;
      if (errorStreak >= 5) {
        console.error(
          "::error::Five model errors in a row; stopping. The endpoint, model or key is probably wrong.",
        );
        exitCode = 1;
        break outer;
      }
    }
  }
} finally {
  await client.close().catch(() => {});
  server?.kill();
}

const report = renderReport({ label: opt.label, model, startedAt, runs });
writeFileSync(resolve(runDir, "REPORT.md"), report);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
const sum = summarise(runs.map((r) => r.score));
console.log(
  `\n${sum.passed}/${sum.runs} passed; ${sum.untracedFigures} untraced figure(s); report in ${runDir}`,
);
// A model endpoint failing for every run is a broken setup, not a result.
if (sum.errors === sum.runs) exitCode = 1;
process.exit(exitCode);
