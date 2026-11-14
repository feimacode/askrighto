/**
 * Energy plan sync. Per retailer: list CURRENT and FUTURE plans, fetch detail only for new or
 * changed plans (plus a rolling re-check of the longest-unverified ones), then apply all
 * changes for that retailer in one transaction. One sync runs at a time, guarded by a
 * PostgreSQL advisory lock. Nothing is invented: a failed retailer keeps its stored plans.
 */
import type { GstBasis } from "./types.js";
import type { CdrClient } from "./cdr-client.js";
import type { Db } from "./db.js";
import { isResidential, normalisePlan, readListItem, type ListItem } from "./normalise.js";
import {
  markRetailer,
  recordChange,
  removePlans,
  storedState,
  upsertPlan,
  upsertRetailer,
} from "./store.js";

export interface Retailer {
  slug: string;
  brandName: string;
  active: boolean;
}

export interface RetailerResult {
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

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  ok: boolean;
  retailers: RetailerResult[];
  requests: { total: number; throttled: number; failed: number; perRetailer: Record<string, { requests: number; throttled: number; failed: number }> };
  plans: { added: number; changed: number; silent: number; removed: number };
  plansPerRetailer: Record<string, number>;
  plansPerPricingModel: Record<string, number>;
  notUnderstood: { plans: number; byReason: Record<string, number> };
  tableSizes: Record<string, number>;
}

export interface SyncOptions {
  db: Db;
  client: CdrClient;
  retailers: Retailer[];
  now?: () => Date;
  /** Every plan is re-verified at least this often (days). */
  recheckDays?: number;
  /** How many retailers are processed at once. The limiter still paces requests per retailer. */
  parallelRetailers?: number;
  log?: (msg: string) => void;
  /** Tests only: production uses the confirmed value in gst.ts. */
  gstBasis?: GstBasis;
}

/** Advisory locks are per database, so the key includes the schema: two schemas never block each other. */
const lockKey = (schema: string) => `${schema}:energy-sync`;

export async function syncRetailer(o: SyncOptions, r: Retailer): Promise<RetailerResult> {
  const now = o.now?.() ?? new Date();
  const res: RetailerResult = { slug: r.slug, ok: false, listed: 0, fetched: 0, added: 0, changed: 0, silent: 0, removed: 0, missingDetail: 0 };
  const pool = o.db.pool;
  try {
    // 1. Fetch everything first; nothing is written until the retailer's data is complete.
    const items = new Map<string, ListItem>();
    for (const eff of ["CURRENT", "FUTURE"] as const) {
      for (const raw of await o.client.listPlans(r.slug, eff)) {
        const item = readListItem(raw);
        if (item && isResidential(item)) items.set(item.planId, item);
      }
    }
    res.listed = items.size;
    const stored = await storedState(pool, r.slug);

    const changed: ListItem[] = [];
    const unchanged: ListItem[] = [];
    for (const it of items.values()) {
      const s = stored.get(it.planId);
      if (!s || s.sourceLastUpdated !== Date.parse(it.lastUpdated)) changed.push(it);
      else unchanged.push(it);
    }
    // 2. Rolling re-check: the longest-unverified unchanged plans, about 1/recheckDays of the total.
    const days = o.recheckDays ?? 7;
    const quota = Math.ceil(items.size / days);
    unchanged.sort((a, b) => stored.get(a.planId)!.verifiedAt.getTime() - stored.get(b.planId)!.verifiedAt.getTime());
    const recheck = unchanged.slice(0, quota);

    const fetchList = [...changed.map((it) => ({ it, recheck: false })), ...recheck.map((it) => ({ it, recheck: true }))];
    const results: Array<{ it: ListItem; recheck: boolean; detail: unknown }> = [];
    for (const f of fetchList) {
      const detail = await o.client.getDetail(r.slug, f.it.planId);
      if (detail === undefined) {
        res.missingDetail++;
        continue;
      }
      results.push({ ...f, detail });
      res.fetched++;
    }

    // 3. One transaction for this retailer.
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await upsertRetailer(c, r.slug, r.brandName, r.active);
      for (const x of results) {
        const n = normalisePlan(r.slug, x.it, x.detail, o.gstBasis);
        const prev = stored.get(x.it.planId);
        if (x.recheck) {
          if (prev && prev.detailHash === n.detailHash) {
            await c.query("UPDATE plans SET verified_at = $2 WHERE plan_id = $1", [x.it.planId, now]);
            continue;
          }
          res.silent++;
          await recordChange(c, x.it.planId, x.it.lastUpdated, n.detailHash, true, now);
        } else {
          if (prev) res.changed++;
          else res.added++;
          await recordChange(c, x.it.planId, x.it.lastUpdated, n.detailHash, false, now);
        }
        await upsertPlan(c, n, x.detail, now);
      }
      const gone = [...stored.keys()].filter((id) => !items.has(id));
      await removePlans(c, gone);
      res.removed = gone.length;
      const count = (await c.query("SELECT count(*)::int AS n FROM plans WHERE retailer_slug = $1", [r.slug])).rows[0].n as number;
      await markRetailer(c, r.slug, true, count, null, now);
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
    // Record the failure outside the rolled-back transaction; stored plans stay as they were.
    try {
      await upsertRetailer(pool, r.slug, r.brandName, r.active);
      await markRetailer(pool, r.slug, false, null, res.error.slice(0, 500), now);
    } catch {
      /* database trouble: the run report still shows the failure */
    }
  }
  return res;
}

async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]!);
  });
  await Promise.all(workers);
}

/** Runs a full sync if the advisory lock is free. Returns undefined when another instance holds it. */
export async function runSync(o: SyncOptions): Promise<SyncReport | undefined> {
  const lockConn = await o.db.pool.connect();
  try {
    const got = (await lockConn.query("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [lockKey(o.db.schema)])).rows[0].ok as boolean;
    if (!got) {
      o.log?.("another instance is syncing; skipping");
      return undefined;
    }
    try {
      return await doSync(o);
    } finally {
      await lockConn.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey(o.db.schema)]);
    }
  } finally {
    lockConn.release();
  }
}

async function doSync(o: SyncOptions): Promise<SyncReport> {
  const started = o.now?.() ?? new Date();
  // sync_runs.ok means "at least one retailer synced", so one failing retailer does not make all data look stale.
  const run = await o.db.pool.query("INSERT INTO sync_runs (started_at) VALUES ($1) RETURNING id", [started]);
  const runId = run.rows[0].id as number;
  const results: RetailerResult[] = [];
  const active = o.retailers.filter((r) => r.active);
  await mapLimit(active, o.parallelRetailers ?? 16, async (r) => {
    const x = await syncRetailer(o, r);
    results.push(x);
    o.log?.(`${r.slug}: ${x.ok ? "ok" : "FAILED " + x.error} listed=${x.listed} fetched=${x.fetched}`);
  });
  results.sort((a, b) => a.slug.localeCompare(b.slug));

  const pool = o.db.pool;
  const [perRet, perModel, nu, sizes] = await Promise.all([
    pool.query("SELECT retailer_slug, count(*)::int AS n FROM plans GROUP BY 1"),
    pool.query(
      `SELECT m AS model, count(*)::int AS n FROM (
         SELECT coalesce(contract->'electricity'->>'pricingModel', contract->'gas'->>'pricingModel', 'NONE') AS m FROM plans) t GROUP BY 1`,
    ),
    pool.query("SELECT unnest(not_understood) AS reason, count(*)::int AS n FROM plans WHERE NOT understood GROUP BY 1"),
    pool.query(
      `SELECT (SELECT count(*)::int FROM plans) AS plans, (SELECT count(*)::int FROM coverage_sets) AS coverage_sets,
              (SELECT count(*)::int FROM plan_changes) AS plan_changes, (SELECT count(*)::int FROM retailers) AS retailers,
              pg_total_relation_size('plans')::bigint AS plans_bytes`,
    ),
  ]);
  const notUnderstoodPlans = (await pool.query("SELECT count(*)::int AS n FROM plans WHERE NOT understood")).rows[0].n as number;
  const stats = o.client.allStats();
  const perRetailer = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { requests: v.requests, throttled: v.throttled, failed: v.failed }]));
  const sum = (f: (v: { requests: number; throttled: number; failed: number }) => number) => Object.values(perRetailer).reduce((a, v) => a + f(v), 0);
  const finished = o.now?.() ?? new Date();
  const ok = results.every((r) => r.ok);
  const report: SyncReport = {
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    elapsedMs: finished.getTime() - started.getTime(),
    ok,
    retailers: results,
    requests: { total: sum((v) => v.requests), throttled: sum((v) => v.throttled), failed: sum((v) => v.failed), perRetailer },
    plans: {
      added: results.reduce((a, r) => a + r.added, 0),
      changed: results.reduce((a, r) => a + r.changed, 0),
      silent: results.reduce((a, r) => a + r.silent, 0),
      removed: results.reduce((a, r) => a + r.removed, 0),
    },
    plansPerRetailer: Object.fromEntries(perRet.rows.map((x) => [x.retailer_slug, x.n])),
    plansPerPricingModel: Object.fromEntries(perModel.rows.map((x) => [x.model, x.n])),
    notUnderstood: { plans: notUnderstoodPlans, byReason: Object.fromEntries(nu.rows.map((x) => [x.reason, x.n])) },
    tableSizes: { ...sizes.rows[0] },
  };
  await pool.query("UPDATE sync_runs SET finished_at=$2, ok=$3, report=$4 WHERE id=$1", [runId, finished, results.some((r) => r.ok), JSON.stringify(report)]);
  return report;
}
