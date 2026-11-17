/** Command-line entry points: health:validate, health:load. Both take a folder of the PHIO ZIP's XML files, already unzipped. */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { hashFiles, loadHealth } from "./load.js";
import { parseHealthFiles } from "./parse.js";
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

function parseDir(args: string[]) {
  const dir = arg(args, "--dir");
  if (!dir)
    throw new Error(
      "Give the folder holding the unzipped PHIO files: --dir FOLDER (unzip privatehealth-DD-mon-YYYY.zip first; it holds one XML file per insurer)",
    );
  const files = readdirSync(resolve(dir))
    .filter((f) => f.toLowerCase().endsWith(".xml") && !f.toLowerCase().endsWith(".xsd"))
    .map((name) => ({ name, xml: readFileSync(join(resolve(dir), name), "utf8") }));
  if (files.length === 0) throw new Error(`No .xml files in ${dir}`);
  const r = parseHealthFiles(files);
  if (r.report.problems.length) {
    for (const p of r.report.problems) console.error(`error: PHIO file: ${p}`);
    process.exit(1);
  }
  return { dir: resolve(dir), files, ...r };
}

export function cliHealthValidate(args: string[]): void {
  const r = parseDir(args);
  console.log(`ok: ${r.report.productsKept} products from ${r.report.insurers} insurers kept of ${r.report.productsRead} read`);
  console.log(JSON.stringify(r.report, null, 2));
}

export async function cliHealthLoad(args: string[]): Promise<void> {
  const r = parseDir(args);
  // The file's own date is shown as the as-of date, so it is given, not guessed.
  const sourceDate = arg(args, "--source-date") ?? statSync(r.dir).mtime.toISOString().slice(0, 10);
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    await loadHealth(db, {
      insurers: r.insurers,
      products: r.products,
      sourceFile: arg(args, "--source-name") ?? basename(r.dir),
      sourceDate,
      fileHash: hashFiles(r.files),
      report: r.report,
      ...(sha() ? { gitSha: sha() } : {}),
    });
    console.log(`Loaded ${r.products.length} products (file dated ${sourceDate}).`);
    console.log(JSON.stringify(r.report, null, 2));
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
