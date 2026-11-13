/** Command-line entry points: `migrate` and `sync-energy [--record DIR] [--retailer SLUG]`. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDb, dbConfig, migrate } from "./db.js";
import { makeSyncDeps, RETAILERS } from "./index.js";
import { runSync, type SyncReport } from "./sync.js";

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function cliMigrate(): Promise<void> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Schema is up to date");
  } finally {
    await db.close();
  }
}

export function formatReport(r: SyncReport): string {
  const lines = [
    `Sync ${r.ok ? "finished" : "finished with failures"} in ${(r.elapsedMs / 1000).toFixed(1)}s`,
    `Requests: ${r.requests.total} (throttled ${r.requests.throttled}, failed ${r.requests.failed})`,
    `Plans: +${r.plans.added} added, ${r.plans.changed} changed, ${r.plans.silent} silently changed, ${r.plans.removed} removed`,
    `Not fully understood: ${r.notUnderstood.plans} ${JSON.stringify(r.notUnderstood.byReason)}`,
    `Per pricing model: ${JSON.stringify(r.plansPerPricingModel)}`,
    `Table sizes: ${JSON.stringify(r.tableSizes)}`,
    "Per retailer:",
    ...r.retailers.map((x) => {
      const q = r.requests.perRetailer[x.slug];
      return `  ${x.slug.padEnd(24)} ${x.ok ? "ok    " : "FAILED"} listed=${x.listed} fetched=${x.fetched} plans=${r.plansPerRetailer[x.slug] ?? 0} requests=${q?.requests ?? 0} throttled=${q?.throttled ?? 0}${x.error ? " error=" + x.error : ""}`;
    }),
  ];
  return lines.join("\n");
}

export async function cliSyncEnergy(args: string[]): Promise<void> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const recordDir = arg(args, "--record");
  const only = arg(args, "--retailer");
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");
  const client = makeSyncDeps(
    process.env,
    recordDir
      ? (rec) => {
          const dir = join(recordDir, safe(rec.retailer));
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${rec.kind}-${safe(rec.key)}.json`), JSON.stringify(rec.body, null, 2));
        }
      : undefined,
  );
  const db = createDb(cfg);
  try {
    await migrate(db);
    const retailers = only ? RETAILERS.filter((r) => r.slug === only) : RETAILERS;
    if (!retailers.length) throw new Error(`Unknown retailer: ${only}`);
    const report = await runSync({ db, client, retailers, log: (m) => console.error(m) });
    if (!report) {
      console.log("Another instance holds the sync lock; nothing done.");
      return;
    }
    console.log(formatReport(report));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await db.close();
  }
}
