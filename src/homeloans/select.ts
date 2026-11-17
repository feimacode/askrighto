/**
 * Picks which published rate of a product answers a question. Pure: it only filters what is stored.
 * Nothing is ranked by suitability; sorting is by a field the user chose, applied by the caller.
 */
import type { HomeLoanProduct, LoanPurpose, LoanRate, LoanRepayment } from "./types.js";

export type RateKind = "variable" | "fixed" | "any";

export interface RateFilter {
  purpose?: "OWNER_OCCUPIED" | "INVESTMENT";
  repayment?: "PRINCIPAL_AND_INTEREST" | "INTEREST_ONLY";
  kind?: RateKind;
  fixedTermYears?: number;
  /** The user's own LVR, as a percentage such as 80. */
  lvrPercent?: number;
}

const applies = (have: LoanPurpose | LoanRepayment, want: string | undefined) =>
  want === undefined || have === want || have === "UNCONSTRAINED";

/** Standards express LVR tier bounds as fractions ("0.8" is 80%). */
export function lvrCovered(r: LoanRate, lvrPercent: number | undefined): boolean {
  const tiers = r.tiers.filter((t) => t.unit === "PERCENT_LVR");
  if (tiers.length === 0 || lvrPercent === undefined) return true;
  return tiers.some((t) => {
    const lo = Number(t.min) * 100;
    const hi = t.max !== undefined ? Number(t.max) * 100 : Infinity;
    return lvrPercent >= lo - 1e-9 && lvrPercent <= hi + 1e-9;
  });
}

const FIXED = new Set(["FIXED", "BUNDLE_DISCOUNT_FIXED"]);
const VARIABLE = new Set(["VARIABLE", "BUNDLE_DISCOUNT_VARIABLE", "DISCOUNT"]);

function typeMatches(r: LoanRate, f: RateFilter): boolean {
  if (r.type === "OTHER") return false;
  const kind = f.kind ?? "any";
  if (kind === "variable") return VARIABLE.has(r.type);
  if (kind === "fixed") {
    if (!FIXED.has(r.type)) return false;
    if (f.fixedTermYears !== undefined) return r.fixedTermMonths === Math.round(f.fixedTermYears * 12);
    return true;
  }
  return true;
}

/** Rates that match everything except possibly the LVR. */
function baseMatches(p: HomeLoanProduct, f: RateFilter): LoanRate[] {
  return p.rates.filter((r) => typeMatches(r, f) && applies(r.purpose, f.purpose) && applies(r.repayment, f.repayment));
}

export interface Selection {
  /** Rates that match every filter, in the order published. */
  rates: LoanRate[];
  /** True when rates matched except that none covers the LVR given. */
  noRateForLvr: boolean;
}

export function selectRates(p: HomeLoanProduct, f: RateFilter): Selection {
  const base = baseMatches(p, f);
  const rates = base.filter((r) => lvrCovered(r, f.lvrPercent));
  return { rates, noRateForLvr: rates.length === 0 && base.length > 0 && f.lvrPercent !== undefined };
}

export const isExpired = (p: HomeLoanProduct, now: Date): boolean =>
  p.effectiveTo !== undefined && Date.parse(p.effectiveTo) < now.getTime();

export const hasFeature = (p: HomeLoanProduct, type: string): boolean => p.features.some((x) => x.type === type);

export const fixedYearsLabel = (r: LoanRate): string | undefined =>
  r.fixedTermMonths === undefined ? undefined : r.fixedTermMonths % 12 === 0 ? `${r.fixedTermMonths / 12} year` + (r.fixedTermMonths === 12 ? "" : "s") : `${r.fixedTermMonths} months`;
