/** Reads and writes of the home loan tables. Writes happen only in the sync; the server reads one cached snapshot. */
import type pg from "pg";
import type { Db } from "../energy/db.js";
import type { CashRate, HomeLoanData, HomeLoanProduct, Lender, LenderStatus } from "./types.js";

type Q = pg.Pool | pg.PoolClient;

export async function upsertLender(q: Q, l: Lender): Promise<void> {
  await q.query(
    `INSERT INTO home_loan_lenders (slug, brand_name, base_uri, active) VALUES ($1,$2,$3,$4)
     ON CONFLICT (slug) DO UPDATE SET brand_name = $2, base_uri = $3, active = $4`,
    [l.slug, l.brandName, l.baseUri, l.active],
  );
}

export async function markLender(q: Q, slug: string, ok: boolean, count: number | null, error: string | null, at: Date): Promise<void> {
  await q.query(
    `UPDATE home_loan_lenders SET last_sync_at = $2, last_sync_ok = $3, last_product_count = coalesce($4, last_product_count), last_error = $5 WHERE slug = $1`,
    [slug, at, ok, count, error],
  );
}

export interface StoredState {
  sourceLastUpdated: number;
  verifiedAt: Date;
  detailHash: string;
}

export async function storedState(q: Q, slug: string): Promise<Map<string, StoredState>> {
  const r = await q.query(
    "SELECT product_id, source_last_updated, verified_at, detail_hash FROM home_loan_products WHERE lender_slug = $1",
    [slug],
  );
  return new Map(
    r.rows.map((x) => [
      x.product_id as string,
      { sourceLastUpdated: (x.source_last_updated as Date).getTime(), verifiedAt: x.verified_at as Date, detailHash: x.detail_hash as string },
    ]),
  );
}

export async function upsertProduct(q: Q, p: HomeLoanProduct, raw: unknown, now: Date): Promise<void> {
  const { rates, fees, features, constraints, eligibility, links } = p;
  await q.query(
    `INSERT INTO home_loan_products (lender_slug, product_id, name, description, is_tailored, effective_from, effective_to,
        understood, not_understood, detail, raw, detail_hash, source_last_updated, fetched_at, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
     ON CONFLICT (lender_slug, product_id) DO UPDATE SET name=$3, description=$4, is_tailored=$5, effective_from=$6, effective_to=$7,
        understood=$8, not_understood=$9, detail=$10, raw=$11, detail_hash=$12, source_last_updated=$13, fetched_at=$14, verified_at=$14`,
    [
      p.lenderSlug, p.productId, p.name, p.description, p.isTailored, p.effectiveFrom ?? null, p.effectiveTo ?? null,
      p.understood, p.notUnderstood,
      JSON.stringify({ brandName: p.brandName, rates, fees, features, constraints, eligibility, links }),
      JSON.stringify(raw), p.detailHash, p.sourceLastUpdated, now,
    ],
  );
}

export async function recordChange(q: Q, lender: string, productId: string, sourceLastUpdated: string, hash: string, silent: boolean, at: Date): Promise<void> {
  await q.query(
    "INSERT INTO home_loan_changes (lender_slug, product_id, changed_at, source_last_updated, detail_hash, silent) VALUES ($1,$2,$3,$4,$5,$6)",
    [lender, productId, at, sourceLastUpdated, hash, silent],
  );
}

export async function removeProducts(q: Q, lender: string, ids: string[]): Promise<void> {
  if (ids.length) await q.query("DELETE FROM home_loan_products WHERE lender_slug = $1 AND product_id = ANY($2)", [lender, ids]);
}

export async function setCashRate(q: Q, r: { effectiveDate: string; valuePct: number; sourceUrl: string }, at: Date): Promise<void> {
  await q.query(
    `INSERT INTO reference_rates (series, effective_date, value_pct, source_url, fetched_at) VALUES ('rba_cash_rate_target',$1,$2,$3,$4)
     ON CONFLICT (series, effective_date) DO UPDATE SET value_pct=$2, source_url=$3, fetched_at=$4`,
    [r.effectiveDate, r.valuePct, r.sourceUrl, at],
  );
}

/** Everything the tools need, read in one go. Volumes are small (a few thousand products). */
export async function readAll(db: Db): Promise<HomeLoanData> {
  const [l, p, c] = await Promise.all([
    db.pool.query("SELECT * FROM home_loan_lenders ORDER BY slug"),
    db.pool.query("SELECT * FROM home_loan_products ORDER BY lender_slug, product_id"),
    db.pool.query(
      "SELECT effective_date::text AS d, value_pct::float8 AS v, source_url, fetched_at FROM reference_rates WHERE series = 'rba_cash_rate_target' ORDER BY effective_date DESC LIMIT 1",
    ),
  ]);
  const lenders: LenderStatus[] = l.rows.map((x) => ({
    slug: x.slug, brandName: x.brand_name, baseUri: x.base_uri, active: x.active,
    ...(x.last_sync_at ? { lastSyncAt: x.last_sync_at } : {}),
    ...(x.last_sync_ok !== null ? { lastSyncOk: x.last_sync_ok } : {}),
    ...(x.last_product_count !== null ? { lastProductCount: x.last_product_count } : {}),
    ...(x.last_error ? { lastError: x.last_error } : {}),
  }));
  const products: HomeLoanProduct[] = p.rows.map((x) => ({
    lenderSlug: x.lender_slug, productId: x.product_id, name: x.name, description: x.description,
    isTailored: x.is_tailored,
    ...(x.effective_from ? { effectiveFrom: (x.effective_from as Date).toISOString() } : {}),
    ...(x.effective_to ? { effectiveTo: (x.effective_to as Date).toISOString() } : {}),
    brandName: x.detail.brandName ?? x.lender_slug,
    rates: x.detail.rates ?? [], fees: x.detail.fees ?? [], features: x.detail.features ?? [],
    constraints: x.detail.constraints ?? [], eligibility: x.detail.eligibility ?? [], links: x.detail.links ?? {},
    understood: x.understood, notUnderstood: x.not_understood,
    sourceLastUpdated: (x.source_last_updated as Date).toISOString(),
    fetchedAt: (x.fetched_at as Date).toISOString(), verifiedAt: (x.verified_at as Date).toISOString(),
    detailHash: x.detail_hash,
  }));
  const cash: CashRate | undefined = c.rows[0]
    ? { effectiveDate: c.rows[0].d, valuePct: c.rows[0].v, sourceUrl: c.rows[0].source_url, fetchedAt: c.rows[0].fetched_at }
    : undefined;
  const times = products.map((x) => Date.parse(x.verifiedAt));
  return {
    lenders, products, ...(cash ? { cashRate: cash } : {}),
    ...(times.length ? { lastVerified: new Date(Math.min(...times)) } : {}),
    loadedAt: new Date(),
  };
}
