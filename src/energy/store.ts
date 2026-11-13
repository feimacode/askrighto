/** Typed reads and writes over the energy tables. Reads hide plans outside their effective dates. */
import type pg from "pg";
import { stableHash } from "./hash.js";
import type { Db } from "./db.js";
import type { Contract, EnergyPlan, FuelType, NormalisedPlan, PlanType } from "./types.js";

type Q = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

export interface StoredPlanState {
  planId: string;
  sourceLastUpdated: number;
  verifiedAt: Date;
  detailHash: string;
}

export async function storedState(q: Q, slug: string): Promise<Map<string, StoredPlanState>> {
  const r = await q.query("SELECT plan_id, source_last_updated, verified_at, detail_hash FROM plans WHERE retailer_slug = $1", [slug]);
  return new Map(
    r.rows.map((x) => [
      x.plan_id as string,
      { planId: x.plan_id, sourceLastUpdated: new Date(x.source_last_updated).getTime(), verifiedAt: x.verified_at as Date, detailHash: x.detail_hash },
    ]),
  );
}

export async function upsertCoverage(q: Q, g: EnergyPlan["geography"]): Promise<number> {
  const inc = g.includedPostcodes.map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  const exc = g.excludedPostcodes.map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  const dist = [...g.distributors].sort();
  const hash = stableHash({ inc, exc, dist });
  const r = await q.query(
    `INSERT INTO coverage_sets (hash, included_postcodes, excluded_postcodes, distributors)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (hash) DO UPDATE SET hash = EXCLUDED.hash
     RETURNING id`,
    [hash, inc, exc, dist],
  );
  return Number(r.rows[0].id);
}

export async function upsertPlan(q: Q, n: NormalisedPlan, raw: unknown, now: Date): Promise<void> {
  const p = n.plan;
  const coverageId = await upsertCoverage(q, p.geography);
  const contract = { electricity: p.electricity ?? null, gas: p.gas ?? null };
  await q.query(
    `INSERT INTO plans (plan_id, retailer_slug, brand_name, display_name, fuel_type, plan_type, customer_type,
        coverage_id, effective_from, effective_to, plan_url, source_last_updated, fetched_at, verified_at,
        understood, not_understood, contract, raw, detail_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (plan_id) DO UPDATE SET
        retailer_slug=EXCLUDED.retailer_slug, brand_name=EXCLUDED.brand_name, display_name=EXCLUDED.display_name,
        fuel_type=EXCLUDED.fuel_type, plan_type=EXCLUDED.plan_type, customer_type=EXCLUDED.customer_type,
        coverage_id=EXCLUDED.coverage_id, effective_from=EXCLUDED.effective_from, effective_to=EXCLUDED.effective_to,
        plan_url=EXCLUDED.plan_url, source_last_updated=EXCLUDED.source_last_updated, fetched_at=EXCLUDED.fetched_at,
        verified_at=EXCLUDED.verified_at, understood=EXCLUDED.understood, not_understood=EXCLUDED.not_understood,
        contract=EXCLUDED.contract, raw=EXCLUDED.raw, detail_hash=EXCLUDED.detail_hash`,
    [
      p.planId, p.retailerSlug, p.brandName, p.displayName, p.fuelType, p.planType, p.customerType,
      coverageId, p.effectiveFrom ?? null, p.effectiveTo ?? null, p.planUrl ?? null,
      p.sourceLastUpdated || now.toISOString(), now, p.understood, p.notUnderstood,
      JSON.stringify(contract), JSON.stringify(raw), n.detailHash,
    ],
  );
}

/** Removes plans the retailer no longer lists. */
export async function removePlans(q: Q, ids: string[]): Promise<void> {
  if (ids.length) await q.query("DELETE FROM plans WHERE plan_id = ANY($1)", [ids]);
}

export async function recordChange(q: Q, planId: string, sourceLastUpdated: string, detailHash: string, silent: boolean, now: Date): Promise<void> {
  await q.query("INSERT INTO plan_changes (plan_id, changed_at, source_last_updated, detail_hash, silent) VALUES ($1,$2,$3,$4,$5)", [
    planId,
    now,
    sourceLastUpdated || null,
    detailHash,
    silent,
  ]);
}

export async function upsertRetailer(q: Q, slug: string, brandName: string, active: boolean): Promise<void> {
  await q.query(
    "INSERT INTO retailers (slug, brand_name, active) VALUES ($1,$2,$3) ON CONFLICT (slug) DO UPDATE SET brand_name=EXCLUDED.brand_name, active=EXCLUDED.active",
    [slug, brandName, active],
  );
}

export async function markRetailer(q: Q, slug: string, ok: boolean, planCount: number | null, error: string | null, now: Date): Promise<void> {
  await q.query("UPDATE retailers SET last_sync_at=$2, last_sync_ok=$3, last_plan_count=COALESCE($4, last_plan_count), last_error=$5 WHERE slug=$1", [
    slug,
    now,
    ok,
    planCount,
    error,
  ]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToPlan(r: Record<string, any>): EnergyPlan {
  const contract = r.contract as { electricity: Contract | null; gas: Contract | null };
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : undefined);
  return {
    planId: r.plan_id,
    retailerSlug: r.retailer_slug,
    brandName: r.brand_name,
    displayName: r.display_name,
    fuelType: r.fuel_type as FuelType,
    planType: r.plan_type as PlanType,
    customerType: "RESIDENTIAL",
    geography: {
      includedPostcodes: (r.included_postcodes as number[] | undefined)?.map(String) ?? [],
      excludedPostcodes: (r.excluded_postcodes as number[] | undefined)?.map(String) ?? [],
      distributors: r.distributors ?? [],
    },
    ...(r.effective_from ? { effectiveFrom: iso(r.effective_from) } : {}),
    ...(r.effective_to ? { effectiveTo: iso(r.effective_to) } : {}),
    ...(contract.electricity ? { electricity: contract.electricity } : {}),
    ...(contract.gas ? { gas: contract.gas } : {}),
    ...(r.plan_url ? { planUrl: r.plan_url } : {}),
    sourceLastUpdated: iso(r.source_last_updated)!,
    fetchedAt: iso(r.fetched_at)!,
    verifiedAt: iso(r.verified_at)!,
    understood: r.understood,
    notUnderstood: r.not_understood ?? [],
  };
}

const PLAN_COLUMNS = `p.plan_id, p.retailer_slug, p.brand_name, p.display_name, p.fuel_type, p.plan_type, p.customer_type,
  p.effective_from, p.effective_to, p.plan_url, p.source_last_updated, p.fetched_at, p.verified_at,
  p.understood, p.not_understood, p.contract, c.included_postcodes, c.excluded_postcodes, c.distributors`;

export interface PlanQuery {
  postcode: string;
  fuelType?: FuelType;
  retailer?: string;
  distributor?: string;
  planType?: PlanType;
}

/** Plans offered at a postcode today. Excluded postcodes, future plans and expired plans are dropped. */
export async function plansByPostcode(q: Q, query: PlanQuery, now: Date = new Date()): Promise<EnergyPlan[]> {
  const pc = Number(query.postcode);
  if (!Number.isInteger(pc)) return [];
  const where = [
    "c.included_postcodes @> ARRAY[$1]::int[]",
    "NOT (c.excluded_postcodes @> ARRAY[$1]::int[])",
    "(p.effective_from IS NULL OR p.effective_from <= $2)",
    "(p.effective_to IS NULL OR p.effective_to > $2)",
  ];
  const args: unknown[] = [pc, now];
  const add = (cond: string, v: unknown) => {
    args.push(v);
    where.push(cond.replace("?", `$${args.length}`));
  };
  if (query.fuelType) add("p.fuel_type = ?", query.fuelType);
  if (query.retailer) add("p.retailer_slug = ?", query.retailer);
  if (query.planType) add("p.plan_type = ?", query.planType);
  if (query.distributor) add("? = ANY(c.distributors)", query.distributor);
  const r = await q.query(
    `SELECT ${PLAN_COLUMNS} FROM plans p JOIN coverage_sets c ON c.id = p.coverage_id WHERE ${where.join(" AND ")} ORDER BY p.brand_name, p.display_name, p.plan_id`,
    args,
  );
  return r.rows.map(rowToPlan);
}

export async function planById(q: Q, planId: string, now: Date = new Date()): Promise<EnergyPlan | undefined> {
  const r = await q.query(
    `SELECT ${PLAN_COLUMNS} FROM plans p JOIN coverage_sets c ON c.id = p.coverage_id
     WHERE p.plan_id = $1 AND (p.effective_from IS NULL OR p.effective_from <= $2) AND (p.effective_to IS NULL OR p.effective_to > $2)`,
    [planId, now],
  );
  return r.rows[0] ? rowToPlan(r.rows[0]) : undefined;
}

export interface StoreSummary {
  retailers: number;
  plans: number;
  failingRetailers: string[];
  lastSuccessfulSync?: Date;
}

export async function summary(db: Db): Promise<StoreSummary> {
  const [p, rt, f, s] = await Promise.all([
    db.pool.query("SELECT count(*)::int AS n FROM plans"),
    db.pool.query("SELECT count(*)::int AS n FROM retailers WHERE active"),
    db.pool.query("SELECT slug FROM retailers WHERE active AND last_sync_ok = false ORDER BY slug"),
    db.pool.query("SELECT max(finished_at) AS t FROM sync_runs WHERE ok"),
  ]);
  return {
    plans: p.rows[0].n,
    retailers: rt.rows[0].n,
    failingRetailers: f.rows.map((x) => x.slug),
    ...(s.rows[0].t ? { lastSuccessfulSync: s.rows[0].t as Date } : {}),
  };
}

/** Small in-process cache for postcode lookups; plans change at most daily. */
export class CachedStore {
  private cache = new Map<string, { at: number; plans: EnergyPlan[] }>();
  constructor(
    private readonly db: Db,
    private readonly ttlMs = 5 * 60_000,
    private readonly clock: () => number = Date.now,
  ) {}

  async plans(query: PlanQuery): Promise<EnergyPlan[]> {
    const key = JSON.stringify(query);
    const hit = this.cache.get(key);
    const t = this.clock();
    if (hit && t - hit.at < this.ttlMs) return hit.plans;
    const plans = await plansByPostcode(this.db.pool, query, new Date(t));
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(key, { at: t, plans });
    return plans;
  }

  async plan(planId: string): Promise<EnergyPlan | undefined> {
    return planById(this.db.pool, planId, new Date(this.clock()));
  }

  clear(): void {
    this.cache.clear();
  }
}
