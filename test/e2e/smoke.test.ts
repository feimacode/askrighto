import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { smoke } from "../../scripts/smoke-remote.mjs";

const BUNDLE = resolve(import.meta.dirname, "../../dist/askrighto.js");
const PORT = String(4700 + Math.floor(Math.random() * 200));
const URL_BASE = `http://127.0.0.1:${PORT}`;
const run = smoke as (
  base: string,
  version: string | undefined,
  tools: string[],
) => Promise<string[]>;

let proc: ChildProcess;
const PUBLIC: string[] = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../plugin/askrighto.config.json"),
    "utf8",
  ),
).publicTools;

describe.skipIf(!existsSync(BUNDLE))("release smoke check", () => {
  beforeAll(async () => {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env))
      if (
        v !== undefined &&
        !/^(DATABASE_|ASKRIGHTO_|TEST_DATABASE_URL)/.test(k)
      )
        env[k] = v;
    proc = spawn(process.execPath, [BUNDLE, "--http"], {
      env: { ...env, PORT, HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((ok) =>
      proc.stdout!.on("data", (d) => String(d).includes("listening") && ok()),
    );
  });
  afterAll(() => proc?.kill());

  it("passes when the server lists exactly the configured public tools", async () => {
    expect(await run(URL_BASE, "0.1.0", PUBLIC)).toEqual([]);
  });

  it("names a wrong version, a missing tool and an extra one", async () => {
    const rest = PUBLIC.filter((t) => t !== "list_data_sources");
    const problems = await run(URL_BASE, "9.9.9", [...rest, "not_a_tool"]);
    expect(problems.join("\n")).toMatch(/version 0\.1\.0, expected 9\.9\.9/);
    expect(problems.join("\n")).toMatch(/missing not_a_tool/);
    expect(problems.join("\n")).toMatch(
      /lists list_data_sources, which is not public/,
    );
  });
});
