/** Command-line entry points for home loans: sync, cash rate, report. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { LENDERS, makeBankingClient } from "./index.js";
import { buildReport, formatReport } from "./report.js";
import { readAll, setCashRate } from "./store.js";
import { runHomeLoanSync } from "./sync.js";

const arg = (args: string[], name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

export async function cliHomeLoanSync(args: string[]): Promise<void> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const only = arg(args, "--lender");
  const recordDir = arg(args, "--record");
  const lenders = only ? LENDERS.filter((l) => l.slug === only) : LENDERS;
  if (!lenders.length) throw new Error(only ? `Unknown lender: ${only}` : "src/homeloans/lenders.json is empty; seed it from the CDR Register first (docs/home-loan-data.md)");
  const client = makeBankingClient(
    process.env,
    recordDir
      ? (rec) => {
          const dir = join(recordDir, safe(rec.lender));
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${rec.kind}-${safe(rec.key)}.json`), JSON.stringify(rec.body, null, 2));
        }
      : undefined,
  );
  const db = createDb(cfg);
  try {
    await migrate(db);
    const report = await runHomeLoanSync({ db, client, lenders, log: (m) => console.error(m) });
    if (!report) return void console.log("Another instance holds the sync lock; nothing done.");
    if (recordDir) {
      mkdirSync(recordDir, { recursive: true });
      writeFileSync(join(recordDir, `sync-report-${safe(report.startedAt)}.json`), JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

export async function cliCashRate(args: string[]): Promise<void> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const date = arg(args, "--date");
  const value = Number(arg(args, "--value"));
  const source = arg(args, "--source");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value) || value < 0 || value > 30 || !source || !/^https:\/\//.test(source))
    throw new Error("Usage: homeloans:cash-rate --date YYYY-MM-DD --value PERCENT --source https://...");
  const db = createDb(cfg);
  try {
    await migrate(db);
    await setCashRate(db.pool, { effectiveDate: date, valuePct: value, sourceUrl: source }, new Date());
    console.log(`Recorded cash rate target ${value}% effective ${date}`);
  } finally {
    await db.close();
  }
}

export async function cliHomeLoanReport(args: string[]): Promise<void> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    const r = buildReport(await readAll(db));
    console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : formatReport(r));
    if (r.problems.length) process.exitCode = 1;
  } finally {
    await db.close();
  }
}
