/** Command-line entry points: benchmarks:validate, benchmarks:load. Both take the AER benchmarks workbook (.xlsx). */
import { execSync } from "node:child_process";
import { basename } from "node:path";
import { createDb, dbConfig, migrate } from "../db.js";
import { loadBenchmarks } from "./load.js";
import { parseBenchmarkFile } from "./parse.js";

const arg = (args: string[], name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const sha = () => {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return undefined;
  }
};

async function parseArgs(args: string[]) {
  const file = arg(args, "--file");
  if (!file) throw new Error("Give the AER benchmarks workbook: --file PATH.xlsx (from https://www.aer.gov.au/documents/frontier-economics-simple-electricity-and-gas-benchmarks-june-2021)");
  const r = await parseBenchmarkFile(file);
  if (r.report.problems.length) {
    for (const p of r.report.problems.slice(0, 20)) console.error(`error: AER benchmarks: ${p}`);
    for (const k of ["postcodesWithoutZone", "duplicateKeys", "nonPositiveValues", "incompleteGroups"] as const) {
      for (const x of r.report[k].slice(0, 10)) console.error(`  ${k}: ${x}`);
    }
    process.exit(1);
  }
  return { file, r };
}

export async function cliBenchmarksValidate(args: string[]): Promise<void> {
  const { r } = await parseArgs(args);
  console.log(`ok: ${r.report.benchmarkRows} benchmark values, ${r.report.postcodeRows} postcodes (${r.report.climatePostcodes} climate zone, ${r.report.saPostcodes} SA zone)`);
  console.log(JSON.stringify(r.report, null, 2));
}

export async function cliBenchmarksLoad(args: string[]): Promise<void> {
  const { file, r } = await parseArgs(args);
  // The AER gives only a month ("published December 2020, updated June 2021 for postcodes"), so the date is given.
  const sourceDate = arg(args, "--source-date");
  if (!sourceDate) throw new Error("Give the release date: --source-date YYYY-MM-DD (the AER page says published December 2020, updated June 2021 for postcodes)");
  const releaseLabel = arg(args, "--release") ?? "Published December 2020, updated June 2021 for postcodes";
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    const n = await loadBenchmarks(db, {
      rows: r.rows,
      postcodes: r.postcodes,
      sourceFile: arg(args, "--source-name") ?? basename(file),
      sourceDate,
      releaseLabel,
      fileHash: r.fileHash,
      report: r.report,
      ...(sha() ? { gitSha: sha() } : {}),
    });
    console.log(`Loaded ${n.rows} benchmark values and ${n.postcodes} postcodes (${releaseLabel}).`);
  } finally {
    await db.close();
  }
}
