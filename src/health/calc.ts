/**
 * Pure calculators for premium after rebate, Medicare levy surcharge and Lifetime Health Cover loading.
 * Money is whole cents and percentages are thousandths of a per cent (24.118% is 24118), so each result is
 * rounded exactly once, at the end. Anything not understood returns NotEstimated with a reason.
 */
import type { Frequency, HealthPremium, HealthProduct, Household } from "./types.js";
import {
  proposedAt,
  ruleAt,
  toMilli,
  TIER_CODES,
  type AgeBand,
  type RatesData,
  type TierCode,
} from "./rules.js";

export type NotEstimatedReason =
  | "rules_out_of_range"
  | "rebate_basis_unclear"
  | "base_day_unclear"
  | "cannot_split_hospital_component"
  | "needs_input";

export interface NotEstimated {
  estimated: false;
  reason: NotEstimatedReason;
  message: string;
  /** A rule that is proposed for the date asked about, mentioned but never used. */
  proposed?: { id: string; note?: string; sourceUrl: string };
}

const PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  annual: 1,
};
export const annualCents = (p: HealthPremium) => p.amountCents * PER_YEAR[p.frequency];
const familyHousehold = (h: Household) => h !== "single";

/** Income tier for an income, from the thresholds of the rule row. Thresholds are the top of each tier. */
export function tierFor(
  income: number,
  household: Household,
  dependentChildren: number,
  thresholds: { single: number[]; family: number[] },
  childIncrement: number,
): TierCode {
  const fam = familyHousehold(household);
  const extra = fam ? Math.max(0, dependentChildren - 1) * childIncrement : 0;
  const t = (fam ? thresholds.family : thresholds.single).map((x) => x + extra);
  if (income <= t[0]!) return "base";
  if (income <= t[1]!) return "tier1";
  if (income <= t[2]!) return "tier2";
  return "tier3";
}

export interface IncomeInput {
  incomeTier?: TierCode;
  income?: number;
  household?: Household;
  dependentChildren?: number;
}

export interface RebateEstimate {
  estimated: true;
  tier: TierCode;
  rebatePercentMilli: number;
  ruleId: string;
  ruleFrom: string;
  ruleTo?: string;
  sourceUrl: string;
  sourceUpdatedOn: string;
  /** Annual premium before rebate, cents. */
  premiumBeforeAnnualCents: number;
  /** Annual premium after rebate, cents. `published` when the file stated it for this tier. */
  premiumAfterAnnualCents: number;
  afterBasis: "published" | "calculated";
  /** Annual cents taken off by the rebate, only for a calculated figure. */
  rebateAnnualCents?: number;
  usedPublishedPremium: HealthPremium;
}

export function estimateRebate(
  rates: RatesData,
  product: HealthProduct,
  input: IncomeInput & { ageBand: AgeBand },
  date: string,
): RebateEstimate | NotEstimated {
  const rule = ruleAt(rates.rebate, date);
  if (!rule) {
    const prop = proposedAt(rates.rebate, date);
    return {
      estimated: false,
      reason: "rules_out_of_range",
      message: `Ask Righto holds no rebate rates in force for ${date}.${prop ? " A change from that date is proposed and is not law, so no figure is calculated from it." : ""}`,
      ...(prop
        ? { proposed: { id: prop.id, sourceUrl: prop.source.url, ...(prop.note ? { note: prop.note } : {}) } }
        : {}),
    };
  }
  let tier = input.incomeTier;
  if (!tier) {
    if (input.income === undefined || !input.household)
      return {
        estimated: false,
        reason: "needs_input",
        message: "Give an income tier, or an income and household type, so the rebate tier can be worked out.",
      };
    tier = tierFor(input.income, input.household, input.dependentChildren ?? 0, rule.thresholds, rule.childIncrement);
  }
  const tierIdx = TIER_CODES.indexOf(tier);
  const percent = rule.percents[input.ageBand][tierIdx];
  if (percent === undefined) return { estimated: false, reason: "needs_input", message: "Unknown income tier." };
  const milli = toMilli(percent);

  // A premium the file already states after this tier is shown as published.
  const published = product.premiums.find((p) => p.basis === "after_rebate" && p.rebateTier === tier);
  const before = product.premiums.find((p) => p.basis === "before_rebate");
  const base = {
    estimated: true as const,
    tier,
    rebatePercentMilli: milli,
    ruleId: rule.id,
    ruleFrom: rule.effectiveFrom,
    ...(rule.effectiveTo ? { ruleTo: rule.effectiveTo } : {}),
    sourceUrl: rule.source.url,
    sourceUpdatedOn: rule.source.pageUpdatedOn,
  };
  if (published && before)
    return {
      ...base,
      premiumBeforeAnnualCents: annualCents(before),
      premiumAfterAnnualCents: annualCents(published),
      afterBasis: "published",
      usedPublishedPremium: published,
    };
  if (!before)
    return {
      estimated: false,
      reason: "rebate_basis_unclear",
      message:
        "The file does not say that any of this product's published premiums is before the rebate, so Ask Righto will not work one out. Ask the insurer for the premium after your rebate.",
    };
  const annual = annualCents(before);
  const after = Math.round((annual * (100000 - milli)) / 100000);
  return {
    ...base,
    premiumBeforeAnnualCents: annual,
    premiumAfterAnnualCents: after,
    afterBasis: "calculated",
    rebateAnnualCents: annual - after,
    usedPublishedPremium: before,
  };
}

export interface SurchargeResult {
  estimated: true;
  tier: TierCode;
  ratePercentMilli: number;
  /** Annual surcharge in cents. */
  surchargeCents: number;
  ruleId: string;
  ruleFrom: string;
  ruleTo?: string;
  sourceUrl: string;
  sourceUpdatedOn: string;
}

export function estimateSurcharge(
  rates: RatesData,
  input: { income: number; household: Household; dependentChildren?: number },
  date: string,
): SurchargeResult | NotEstimated {
  const rule = ruleAt(rates.mls, date);
  if (!rule)
    return {
      estimated: false,
      reason: "rules_out_of_range",
      message: `Ask Righto holds no Medicare levy surcharge rates in force for ${date}.`,
    };
  const tier = tierFor(input.income, input.household, input.dependentChildren ?? 0, rule.thresholds, rule.childIncrement);
  const milli = toMilli(rule.ratePercents[TIER_CODES.indexOf(tier)]!);
  return {
    estimated: true,
    tier,
    ratePercentMilli: milli,
    // dollars x rate: cents = income * 100 * milli / 100000
    surchargeCents: Math.round((input.income * 100 * milli) / 100000),
    ruleId: rule.id,
    ruleFrom: rule.effectiveFrom,
    ...(rule.effectiveTo ? { ruleTo: rule.effectiveTo } : {}),
    sourceUrl: rule.source.url,
    sourceUpdatedOn: rule.source.pageUpdatedOn,
  };
}

export interface LhcResult {
  estimated: true;
  loadingPercent: number;
  removed: boolean;
  yearsOver30: number;
  ruleId: string;
  sourceUrl: string;
  sourceUpdatedOn: string;
}

export function estimateLhc(
  rates: RatesData,
  input: { ageAtFirstHospitalCover: number; yearsOfContinuousCover?: number; unusualCircumstances?: boolean },
  date: string,
): LhcResult | NotEstimated {
  const rule = ruleAt(rates.lhc, date);
  if (!rule)
    return {
      estimated: false,
      reason: "rules_out_of_range",
      message: `Ask Righto holds no Lifetime Health Cover rule in force for ${date}.`,
    };
  if (input.unusualCircumstances)
    return {
      estimated: false,
      reason: "base_day_unclear",
      message:
        "The ATO says some circumstances change the base day (for example being overseas on it). Ask Righto does not work those out; use the ATO page or ask your insurer for your Lifetime Health Cover statement.",
    };
  const over = Math.max(0, Math.floor(input.ageAtFirstHospitalCover) - rule.startAge);
  const removed = (input.yearsOfContinuousCover ?? 0) >= rule.yearsToRemove;
  const loadingPercent = removed ? 0 : Math.min(rule.capPercent, over * rule.percentPerYearOver);
  return {
    estimated: true,
    loadingPercent,
    removed,
    yearsOver30: over,
    ruleId: rule.id,
    sourceUrl: rule.source.url,
    sourceUpdatedOn: rule.source.pageUpdatedOn,
  };
}

/** Dollars and cents for text, e.g. 123456 -> "$1,234.56". */
export const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pctText = (milli: number) => `${milli / 1000}%`;
