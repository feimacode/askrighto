/**
 * Re-runs the normaliser over the raw payloads already stored, without calling the CDR API.
 * A sync only re-normalises plans whose source changed, so a normaliser fix (or a change of
 * GST basis) reaches the plans already loaded only through this. The raw payload and its hash
 * are left as they are; only the normalised columns change.
 */
import type { Db } from "./db.js";
import { GST_BASIS } from "./gst.js";
import { stableHash } from "./hash.js";
import { normalisePlan, type ListItem } from "./normalise.js";
import type { GstBasis } from "./types.js";

export interface RenormaliseReport {
  plans: number;
  updated: number;
  before: Record<string, number>;
  after: Record<string, number>;
  /** Raw fragments of the plans still flagged with `show`, for teaching the normaliser new shapes. */
  samples: Array<{ planId: string; reasons: string[]; fragment: unknown }>;
}

const count = (rows: string[][]) => {
  const out: Record<string, number> = {};
  for (const reasons of rows) for (const r of reasons) out[r] = (out[r] ?? 0) + 1;
  return out;
};

/** The part of the raw payload that a reason is about, so a shape can be read without the whole plan. */
function fragment(raw: { electricityContract?: Record<string, unknown>; gasContract?: Record<string, unknown> } | null, reason: string): unknown {
  const pick = (key: string) => ({
    ...(raw?.electricityContract?.[key] !== undefined ? { electricity: raw.electricityContract[key] } : {}),
    ...(raw?.gasContract?.[key] !== undefined ? { gas: raw.gasContract[key] } : {}),
  });
  if (reason.startsWith("solarFeedIn")) return pick("solarFeedInTariff");
  if (reason.startsWith("controlledLoad")) return pick("controlledLoad");
  if (reason.startsWith("tariffPeriod") || reason.startsWith("rateBlockUType") || reason.startsWith("dailySupplyChargeType")) return pick("tariffPeriod");
  if (reason.startsWith("discountMethod")) return pick("discounts");
  return undefined;
}

export async function renormalise(
  db: Db,
  o: { retailer?: string; dryRun?: boolean; show?: string; gstBasis?: GstBasis; maxSamples?: number } = {},
): Promise<RenormaliseReport> {
  const r = await db.pool.query(
    `SELECT p.plan_id, p.retailer_slug, p.source_last_updated, p.effective_from, p.effective_to, p.brand_name, p.display_name,
            p.fuel_type, p.plan_type, p.not_understood, p.contract, p.raw, c.included_postcodes, c.excluded_postcodes, c.distributors
       FROM plans p JOIN coverage_sets c ON c.id = p.coverage_id
      WHERE ($1::text IS NULL OR p.retailer_slug = $1)
      ORDER BY p.plan_id`,
    [o.retailer ?? null],
  );
  const before: string[][] = [];
  const after: string[][] = [];
  const samples: RenormaliseReport["samples"] = [];
  let updated = 0;
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of r.rows) {
      const item: ListItem = {
        planId: row.plan_id,
        lastUpdated: new Date(row.source_last_updated).toISOString(),
        ...(row.effective_from ? { effectiveFrom: new Date(row.effective_from).toISOString() } : {}),
        ...(row.effective_to ? { effectiveTo: new Date(row.effective_to).toISOString() } : {}),
        customerType: "RESIDENTIAL",
        fuelType: row.fuel_type,
        type: row.plan_type,
        displayName: row.display_name,
        brandName: row.brand_name,
        geography: {
          includedPostcodes: (row.included_postcodes as number[]).map(String),
          excludedPostcodes: (row.excluded_postcodes as number[]).map(String),
          distributors: row.distributors,
        },
      };
      const n = normalisePlan(row.retailer_slug, item, row.raw, o.gstBasis ?? GST_BASIS);
      before.push(row.not_understood);
      after.push(n.plan.notUnderstood);
      if (o.show) {
        const hit = n.plan.notUnderstood.find((x) => x.startsWith(o.show!));
        if (hit && samples.length < (o.maxSamples ?? 50)) samples.push({ planId: row.plan_id, reasons: n.plan.notUnderstood, fragment: fragment(row.raw, hit) });
      }
      const contract = { electricity: n.plan.electricity ?? null, gas: n.plan.gas ?? null };
      // jsonb does not keep key order, so compare by a key-order-free hash.
      if (stableHash(contract) === stableHash(row.contract) && stableHash(n.plan.notUnderstood) === stableHash(row.not_understood)) continue;
      updated++;
      if (!o.dryRun) {
        await client.query("UPDATE plans SET understood = $2, not_understood = $3, contract = $4 WHERE plan_id = $1", [
          row.plan_id,
          n.plan.understood,
          n.plan.notUnderstood,
          JSON.stringify(contract),
        ]);
      }
    }
    await client.query(o.dryRun ? "ROLLBACK" : "COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  return { plans: r.rows.length, updated, before: count(before), after: count(after), samples };
}
