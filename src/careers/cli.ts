/** Command-line entry points: careers:validate, careers:load. Both take the JSA employment projections .xlsx file. */
import { execSync } from "node:child_process";
import { basename } from "node:path";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { loadCareers } from "./load.js";
import { parseProjectionsFile } from "./parse.js";

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
  if (!file) throw new Error("Give the JSA employment projections workbook: --file PATH.xlsx (from https://www.jobsandskills.gov.au/data/employment-projections)");
  const r = await parseProjectionsFile(file);
  if (r.report.problems.length) {
    for (const p of r.report.problems.slice(0, 20)) console.error(`error: JSA file: ${p}`);
    process.exit(1);
  }
  return { file, r };
}

export async function cliCareersValidate(args: string[]): Promise<void> {
  const { r } = await parseArgs(args);
  console.log(`ok: ${r.report.unitGroups} unit groups (${r.report.rowsRead} rows read, ${r.report.nfdRows} nfd rows), ${r.classification}, ${r.baselineLabel} to ${r.endLabel}`);
  console.log(JSON.stringify(r.report, null, 2));
}

export async function cliCareersLoad(args: string[]): Promise<void> {
  const { file, r } = await parseArgs(args);
  // The workbook carries no release date we trust, so it is given, never guessed.
  const sourceDate = arg(args, "--source-date");
  if (!sourceDate) throw new Error("Give the release date shown on the JSA page: --source-date YYYY-MM-DD");
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    await loadCareers(db, {
      occupations: r.occupations,
      baselineLabel: r.baselineLabel,
      midLabel: r.midLabel,
      endLabel: r.endLabel,
      classification: r.classification,
      sourceFile: arg(args, "--source-name") ?? basename(file),
      sourceDate,
      fileHash: r.fileHash,
      report: r.report,
      ...(sha() ? { gitSha: sha() } : {}),
    });
    console.log(`Loaded ${r.occupations.length} occupation rows (release dated ${sourceDate}).`);
  } finally {
    await db.close();
  }
}
