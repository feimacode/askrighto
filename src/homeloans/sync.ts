/**
 * Home loan sync. Per lender: list current residential mortgages, fetch detail only for new or changed
 * products (plus a rolling re-check of the longest-unverified ones), then apply that lender's changes in
 * one transaction. One sync runs at a time (PostgreSQL advisory lock). A failed lender keeps its stored
 * products and their old `verified_at`, so freshness never looks better than it is.
 */
import type { Db } from "../energy/db.js";
import type { BankingClient } from "./client.js";
import { isHomeLoan, normaliseProduct, readListItem, type ListItem } from "./normalise.js";
import {
  markLender, recordChange, removeProducts, storedState, upsertLender, upsertProduct,
} from "./store.js";
import type { Lender } from "./types.js";

export interface LenderResult {
  slug: string;
  ok: boolean;
  error?: string;
  listed: number;
  fetched: number;
  added: number;
  changed: number;
  silent: number;
  removed: number;
  missingDetail: number;
}

export interface HomeLoanSyncReport {
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  ok: boolean;
  lenders: LenderResult[];
  requests: { total: number; throttled: number; failed: number; perLender: Record<string, { requests: number; throttled: number; failed: number }> };
  products: { added: number; changed: number; silent: number; removed: number };
  notUnderstood: { products: number; byReason: Record<string, number> };
  productsPerLender: Record<string, number>;
}

export interface HomeLoanSyncOptions {
  db: Db;
  client: BankingClient;
  lenders: Lender[];
  now?: () => Date;
  recheckDays?: number;
  parallelLenders?: number;
  log?: (msg: string) => void;
}

const lockKey = (schema: string) => `${schema}:home-loan-sync`;

export async function syncLender(o: HomeLoanSyncOptions, l: Lender): Promise<LenderResult> {
  const now = o.now?.() ?? new Date();
  const res: LenderResult = { slug: l.slug, ok: false, listed: 0, fetched: 0, added: 0, changed: 0, silent: 0, removed: 0, missingDetail: 0 };
  const pool = o.db.pool;
  try {
    const items = new Map<string, ListItem>();
    for (const raw of await o.client.listProducts(l)) {
      const item = readListItem(raw);
      if (item && isHomeLoan(item)) items.set(item.productId, item);
    }
    res.listed = items.size;
    const stored = await storedState(pool, l.slug);

    const changed: ListItem[] = [];
    const unchanged: ListItem[] = [];
    for (const it of items.values()) {
      const s = stored.get(it.productId);
      if (!s || s.sourceLastUpdated !== Date.parse(it.lastUpdated)) changed.push(it);
      else unchanged.push(it);
    }
    const quota = Math.ceil(items.size / (o.recheckDays ?? 7));
    unchanged.sort((a, b) => stored.get(a.productId)!.verifiedAt.getTime() - stored.get(b.productId)!.verifiedAt.getTime());
    const fetchList = [
      ...changed.map((it) => ({ it, recheck: false })),
      ...unchanged.slice(0, quota).map((it) => ({ it, recheck: true })),
    ];
    const results: Array<{ it: ListItem; recheck: boolean; detail: unknown }> = [];
    for (const f of fetchList) {
      const detail = await o.client.getDetail(l, f.it.productId);
      if (detail === undefined) { res.missingDetail++; continue; }
      results.push({ ...f, detail });
      res.fetched++;
    }

    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await upsertLender(c, l);
      for (const x of results) {
        const n = normaliseProduct(l.slug, x.it, x.detail, now);
        const prev = stored.get(x.it.productId);
        if (x.recheck) {
          if (prev && prev.detailHash === n.detailHash) {
            await c.query("UPDATE home_loan_products SET verified_at = $3 WHERE lender_slug = $1 AND product_id = $2", [l.slug, x.it.productId, now]);
            continue;
          }
          res.silent++;
          await recordChange(c, l.slug, x.it.productId, x.it.lastUpdated, n.detailHash, true, now);
        } else {
          if (prev) res.changed++; else res.added++;
          await recordChange(c, l.slug, x.it.productId, x.it.lastUpdated, n.detailHash, false, now);
        }
        await upsertProduct(c, n, x.detail, now);
      }
      const gone = [...stored.keys()].filter((id) => !items.has(id));
      await removeProducts(c, l.slug, gone);
      res.removed = gone.length;
      const count = (await c.query("SELECT count(*)::int AS n FROM home_loan_products WHERE lender_slug = $1", [l.slug])).rows[0].n as number;
      await markLender(c, l.slug, true, count, null, now);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    res.ok = true;
  } catch (e) {
    res.error = (e as Error).message;
    try {
      await upsertLender(pool, l);
      await markLender(pool, l.slug, false, null, res.error.slice(0, 500), now);
    } catch { /* the run report still shows the failure */ }
  }
  return res;
}

async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

/** Runs a full sync if the advisory lock is free; undefined when another instance holds it. */
export async function runHomeLoanSync(o: HomeLoanSyncOptions): Promise<HomeLoanSyncReport | undefined> {
  const lockConn = await o.db.pool.connect();
  try {
    const got = (await lockConn.query("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [lockKey(o.db.schema)])).rows[0].ok as boolean;
    if (!got) { o.log?.("another instance is syncing; skipping"); return undefined; }
    try { return await doSync(o); }
    finally { await lockConn.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey(o.db.schema)]); }
  } finally { lockConn.release(); }
}

async function doSync(o: HomeLoanSyncOptions): Promise<HomeLoanSyncReport> {
  const started = o.now?.() ?? new Date();
  const run = await o.db.pool.query("INSERT INTO home_loan_sync_runs (started_at) VALUES ($1) RETURNING id", [started]);
  const results: LenderResult[] = [];
  await mapLimit(o.lenders.filter((l) => l.active), o.parallelLenders ?? 16, async (l) => {
    const x = await syncLender(o, l);
    results.push(x);
    o.log?.(`${l.slug}: ${x.ok ? "ok" : "FAILED " + x.error} listed=${x.listed} fetched=${x.fetched}`);
  });
  results.sort((a, b) => a.slug.localeCompare(b.slug));
  const pool = o.db.pool;
  const [per, nu, nuTotal] = await Promise.all([
    pool.query("SELECT lender_slug, count(*)::int AS n FROM home_loan_products GROUP BY 1"),
    pool.query("SELECT unnest(not_understood) AS reason, count(*)::int AS n FROM home_loan_products WHERE NOT understood GROUP BY 1"),
    pool.query("SELECT count(*)::int AS n FROM home_loan_products WHERE NOT understood"),
  ]);
  const stats = o.client.allStats();
  const perLender = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { requests: v.requests, throttled: v.throttled, failed: v.failed }]));
  const sum = (f: (v: { requests: number; throttled: number; failed: number }) => number) => Object.values(perLender).reduce((a, v) => a + f(v), 0);
  const finished = o.now?.() ?? new Date();
  const report: HomeLoanSyncReport = {
    startedAt: started.toISOString(), finishedAt: finished.toISOString(), elapsedMs: finished.getTime() - started.getTime(),
    ok: results.every((r) => r.ok), lenders: results,
    requests: { total: sum((v) => v.requests), throttled: sum((v) => v.throttled), failed: sum((v) => v.failed), perLender },
    products: {
      added: results.reduce((a, r) => a + r.added, 0), changed: results.reduce((a, r) => a + r.changed, 0),
      silent: results.reduce((a, r) => a + r.silent, 0), removed: results.reduce((a, r) => a + r.removed, 0),
    },
    notUnderstood: { products: nuTotal.rows[0].n, byReason: Object.fromEntries(nu.rows.map((x) => [x.reason, x.n])) },
    productsPerLender: Object.fromEntries(per.rows.map((x) => [x.lender_slug, x.n])),
  };
  await pool.query("UPDATE home_loan_sync_runs SET finished_at=$2, ok=$3, report=$4 WHERE id=$1", [run.rows[0].id, finished, results.some((r) => r.ok), JSON.stringify(report)]);
  return report;
}
