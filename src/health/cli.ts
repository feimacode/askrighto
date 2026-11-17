/** Command-line entry points: health:validate, health:load. Both take a folder of the PHIO ZIP's XML files, already unzipped. */
import { execSync } from "node:child_process";
import { basename } from "node:path";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { loadHealth } from "./load.js";
import { parseHealthDir, type HealthParseReport } from "./parse.js";
import { loadRates, overdueRules } from "./rules.js";

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

async function parseDir(args: string[]) {
  const dir = arg(args, "--dir");
  if (!dir)
    throw new Error(
      "Give the folder holding the unzipped PHIO files: --dir FOLDER (unzip the PrivateHealth.gov.au ZIP first; it holds one XML file per cover type and status, plus a Funds file)",
    );
  const r = await parseHealthDir(dir, { includeClosed: args.includes("--include-closed") });
  if (r.report.problems.length) {
    for (const p of r.report.problems.slice(0, 20)) console.error(`error: PHIO file: ${p}`);
    if (r.report.problems.length > 20) console.error(`error: ... and ${r.report.problems.length - 20} more`);
    process.exit(1);
  }
  if (r.products.length === 0) {
    console.error("error: PHIO file: no products were kept");
    process.exit(1);
  }
  return r;
}

/** Prints the report without the long id lists. */
const summary = (r: HealthParseReport) =>
  JSON.stringify(
    { ...r, duplicateIds: `${r.duplicateIds.length} duplicate ids`, problems: `${r.problems.length} problems` },
    null,
    2,
  );

export async function cliHealthValidate(args: string[]): Promise<void> {
  const r = await parseDir(args);
  console.log(`ok: ${r.report.productsKept} products from ${r.report.insurers} insurers kept of ${r.report.productsRead} read`);
  console.log(summary(r.report));
}

export async function cliHealthLoad(args: string[]): Promise<void> {
  const r = await parseDir(args);
  // The date in the file names is the file's date; it is shown as the as-of date, so it is given or read, never guessed.
  const sourceDate = arg(args, "--source-date") ?? r.fileDate;
  if (!sourceDate) throw new Error("The file names carry no single date; give --source-date YYYY-MM-DD");
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    await loadHealth(db, {
      insurers: r.insurers,
      products: r.products,
      categoryTitles: r.categoryTitles,
      sourceFile: arg(args, "--source-name") ?? basename(r.dir),
      sourceDate,
      fileHash: r.fileHash,
      report: r.report,
      ...(sha() ? { gitSha: sha() } : {}),
    });
    console.log(`Loaded ${r.products.length} products (file dated ${sourceDate}).`);
    console.log(summary(r.report));
  } finally {
    await db.close();
  }
}

/** health:rates-validate: checks data/health/rates.yaml and lists rows past their review date. */
export function cliHealthRatesValidate(): void {
  const rates = loadRates();
  const overdue = overdueRules(rates);
  console.log(`ok: ${rates.rebate.length} rebate, ${rates.mls.length} surcharge and ${rates.lhc.length} loading rows`);
  if (overdue.length) {
    for (const o of overdue) console.error(`overdue: ${o}`);
    process.exit(1);
  }
}
