/**
 * Turns a CDR banking product detail (BankingProductDetailV7, dsb-schema-tools 1.35.0) into our model.
 * Nothing is computed, rounded or repaired: rates stay as the lender sent them, and anything we do not
 * understand is kept and flagged so the product is not offered for comparison.
 */
import { createHash } from "node:crypto";
import type {
  HomeLoanProduct,
  LoanConstraint,
  LoanFee,
  LoanPurpose,
  LoanRate,
  LoanRateType,
  LoanRepayment,
  RateTier,
} from "./types.js";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;
/** Tier bounds arrive as strings from most lenders and as JSON numbers from some (Great Southern). */
const numStr = (v: unknown): string | undefined =>
  typeof v === "number" && Number.isFinite(v) ? String(v) : str(v);

export interface ListItem {
  productId: string;
  name: string;
  category: string;
  lastUpdated: string;
  brand?: string;
  brandName?: string;
  isTailored: boolean;
}

export function readListItem(raw: unknown): ListItem | undefined {
  const o = obj(raw);
  const productId = str(o?.productId);
  const lastUpdated = str(o?.lastUpdated);
  if (!o || !productId || !lastUpdated || Number.isNaN(Date.parse(lastUpdated)))
    return undefined;
  return {
    productId,
    name: str(o.name) ?? productId,
    category: str(o.productCategory) ?? "",
    lastUpdated,
    ...(str(o.brand) ? { brand: str(o.brand)! } : {}),
    ...(str(o.brandName) ? { brandName: str(o.brandName)! } : {}),
    isTailored: o.isTailored === true,
  };
}

export const isHomeLoan = (i: ListItem) => i.category === "RESIDENTIAL_MORTGAGES";

const RATE_TYPES: Record<string, LoanRateType> = {
  VARIABLE: "VARIABLE",
  FIXED: "FIXED",
  INTRODUCTORY: "INTRODUCTORY",
  DISCOUNT: "DISCOUNT",
  BUNDLE_DISCOUNT_FIXED: "BUNDLE_DISCOUNT_FIXED",
  BUNDLE_DISCOUNT_VARIABLE: "BUNDLE_DISCOUNT_VARIABLE",
};
/** Rate types that exist in the standards but are not part of a normal home loan comparison. */
const KNOWN_OTHER = new Set([
  "FLOATING",
  "MARKET_LINKED",
  "PENALTY",
  "PURCHASE",
  "CASH_ADVANCE",
  "BALANCE_TRANSFER",
  "FEE",
]);
const PURPOSES = ["OWNER_OCCUPIED", "INVESTMENT", "OTHER", "UNCONSTRAINED"];
const REPAYMENTS = ["PRINCIPAL_AND_INTEREST", "INTEREST_ONLY", "OTHER", "UNCONSTRAINED"];
const TIER_UNITS: Record<string, RateTier["unit"]> = {
  PERCENT: "PERCENT_LVR",
  DOLLAR: "DOLLAR",
  MONTH: "MONTH",
  DAY: "DAY",
};

/** "0.0599" is a fraction (5.99%). Anything outside 0 to 1 is not a RateString we understand. */
export function rateToPct(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 1) return undefined;
  return Math.round(n * 1e6) / 1e4;
}

/** ISO 8601 duration to whole months (P3Y, P36M, P1Y6M). Weeks and days are not a home loan fixed term. */
export function isoMonths(s: string | undefined): number | undefined {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(s ?? "");
  if (!m || (m[1] === undefined && m[2] === undefined)) return undefined;
  return Number(m[1] ?? 0) * 12 + Number(m[2] ?? 0);
}

export function normaliseProduct(
  lenderSlug: string,
  item: ListItem,
  detail: unknown,
  now: Date = new Date(),
): HomeLoanProduct {
  const d = obj(detail) ?? {};
  const flags: string[] = [];
  const flag = (f: string) => {
    if (!flags.includes(f)) flags.push(f);
  };

  const rates: LoanRate[] = [];
  for (const r of arr(d.lendingRates)) {
    const o = obj(r);
    if (!o) {
      flag("rate:not_an_object");
      continue;
    }
    const rawType = str(o.lendingRateType) ?? "";
    const type = RATE_TYPES[rawType] ?? "OTHER";
    if (!RATE_TYPES[rawType] && !KNOWN_OTHER.has(rawType)) flag(`rateType:${rawType || "missing"}`);
    const rate = str(o.rate);
    const ratePct = rateToPct(rate);
    if (rate === undefined || ratePct === undefined) {
      flag("rate:not_a_fraction");
      continue;
    }
    const cmp = str(o.comparisonRate);
    const cmpPct = rateToPct(cmp);
    if (cmp !== undefined && cmpPct === undefined) flag("comparisonRate:not_a_fraction");
    const purposeRaw = str(o.loanPurpose);
    const repayRaw = str(o.repaymentType);
    // V2 allowed these to be absent, meaning "applies to all".
    const purpose = (purposeRaw && PURPOSES.includes(purposeRaw) ? purposeRaw : purposeRaw ? "OTHER" : "UNCONSTRAINED") as LoanPurpose;
    const repayment = (repayRaw && REPAYMENTS.includes(repayRaw) ? repayRaw : repayRaw ? "OTHER" : "UNCONSTRAINED") as LoanRepayment;
    let fixedTermMonths: number | undefined;
    if (type === "FIXED" || type === "BUNDLE_DISCOUNT_FIXED") {
      fixedTermMonths = isoMonths(str(o.additionalValue));
      if (fixedTermMonths === undefined) flag("fixedRate:no_term");
    }
    const tiers: RateTier[] = [];
    for (const t of arr(o.tiers)) {
      const to = obj(t);
      const unit = TIER_UNITS[str(to?.unitOfMeasure) ?? ""];
      const min = numStr(to?.minimumValue);
      if (!to || !unit || min === undefined) {
        flag("tier:unknown_unit");
        continue;
      }
      tiers.push({
        unit,
        min,
        ...(numStr(to.maximumValue) ? { max: numStr(to.maximumValue)! } : {}),
        ...(str(to.rateApplicationMethod) ? { method: str(to.rateApplicationMethod)! } : {}),
        ...(str(to.name) ? { name: str(to.name)! } : {}),
      });
    }
    const conditions = [
      str(o.additionalInfo),
      ...arr(o.applicabilityConditions).map((c) => str(obj(c)?.additionalInfo)),
      ...arr(o.tiers).flatMap((t) => arr(obj(t)?.applicabilityConditions).map((c) => str(obj(c)?.additionalInfo))),
    ].filter((x): x is string => !!x);
    rates.push({
      type,
      rawType,
      rate,
      ratePct,
      ...(cmp !== undefined ? { comparisonRate: cmp } : {}),
      ...(cmpPct !== undefined ? { comparisonRatePct: cmpPct } : {}),
      purpose,
      repayment,
      ...(fixedTermMonths !== undefined ? { fixedTermMonths } : {}),
      tiers,
      conditions,
    });
  }
  if (rates.length === 0) flag("rates:none");

  const fees: LoanFee[] = arr(d.fees).flatMap((f) => {
    const o = obj(f);
    const name = str(o?.name);
    if (!o || !name) return [];
    const m = str(o.feeMethodUType);
    const method = m === "fixedAmount" || m === "rateBased" || m === "variable" ? m : "unknown";
    const fa = obj(o.fixedAmount);
    const rb = obj(o.rateBased);
    const va = obj(o.variable);
    return [
      {
        name,
        feeType: str(o.feeType) ?? "OTHER",
        method,
        ...(str(fa?.amount) ? { amount: str(fa?.amount)! } : {}),
        ...(str(rb?.amount) ? { rate: str(rb?.amount)! } : {}),
        ...(str(rb?.rateType) ? { rateType: str(rb?.rateType)! } : {}),
        ...(str(o.additionalInfo) ?? str(va?.feeMinimum) ? { note: (str(o.additionalInfo) ?? str(va?.feeMinimum))! } : {}),
        discounts: arr(o.discounts).length,
      } satisfies LoanFee,
    ];
  });

  const features = arr(d.features).flatMap((f) => {
    const o = obj(f);
    const type = str(o?.featureType);
    return type ? [{ type, ...(str(o?.additionalInfo) ? { note: str(o?.additionalInfo)! } : {}) }] : [];
  });
  const constraints: LoanConstraint[] = arr(d.constraints).flatMap((c) => {
    const o = obj(c);
    const type = str(o?.constraintType);
    return type
      ? [
          {
            type,
            ...(str(o?.additionalValue) ? { value: str(o?.additionalValue)! } : {}),
            ...(str(o?.additionalInfo) ? { note: str(o?.additionalInfo)! } : {}),
          },
        ]
      : [];
  });
  const eligibility = arr(d.eligibility).flatMap((e) => {
    const o = obj(e);
    const t = str(o?.eligibilityType);
    const extra = str(o?.additionalInfo) ?? str(o?.additionalValue);
    return t ? [extra ? `${t}: ${extra}` : t] : [];
  });

  const info = obj(d.additionalInformation);
  const link = (v: unknown) => {
    const u = str(v);
    return u && /^https?:\/\//.test(u) ? u : undefined;
  };
  const links: HomeLoanProduct["links"] = {
    ...(link(info?.overviewUri) ? { product: link(info?.overviewUri)! } : {}),
    ...(link(d.applicationUri) ? { apply: link(d.applicationUri)! } : {}),
    ...(link(info?.feesAndPricingUri) ? { feesAndPricing: link(info?.feesAndPricingUri)! } : {}),
    ...(link(info?.eligibilityUri) ? { eligibility: link(info?.eligibilityUri)! } : {}),
    ...(link(info?.termsUri) ? { terms: link(info?.termsUri)! } : {}),
  };

  const name = str(d.name) ?? item.name;
  const description = str(d.description) ?? "";
  if (/\b(construction|reverse mortgage|bridging|equity release)\b/i.test(`${name} ${description}`))
    flag("category:possible_construction_or_reverse");

  const nowIso = now.toISOString();
  return {
    lenderSlug,
    productId: item.productId,
    brandName: str(d.brandName) ?? item.brandName ?? item.brand ?? lenderSlug,
    name,
    description,
    isTailored: d.isTailored === true || item.isTailored,
    ...(str(d.effectiveFrom) ? { effectiveFrom: str(d.effectiveFrom)! } : {}),
    ...(str(d.effectiveTo) ? { effectiveTo: str(d.effectiveTo)! } : {}),
    rates,
    fees,
    features,
    constraints,
    eligibility,
    links,
    understood: flags.length === 0,
    notUnderstood: flags,
    sourceLastUpdated: item.lastUpdated,
    fetchedAt: nowIso,
    verifiedAt: nowIso,
    detailHash: hashDetail(detail),
  };
}

/** Stable hash of a payload, ignoring key order. */
export function hashDetail(v: unknown): string {
  const canon = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(canon)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.entries(x as Obj)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, val]) => [k, canon(val)]),
          )
        : x;
  return createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
}
