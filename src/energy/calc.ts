/**
 * Annual cost estimate for one plan: a pure function of (plan, usage). Same inputs and data
 * give the same output. Nothing is guessed: a plan that cannot be estimated from published
 * rates and the usage given is returned as NotEstimated with a reason.
 *
 * Assumptions (also stated to users): usage is spread evenly across the year; seasonal tariff
 * periods get usage in proportion to their days; the year has 365 days; money is carried as
 * scaled integers (see money.ts) and each reported component is rounded once to the cent.
 */
import { MONEY_SCALE } from "./money.js";
import type { Contract, Discount, EnergyPlan, FeedIn, Rate, TariffPeriod, TimeOfUseRate } from "./types.js";

export type NotEstimatedReason =
  | "demand_tariff"
  | "needs_time_of_use_split"
  | "not_fully_understood"
  | "no_controlled_load_rate"
  | "gst_basis_unknown"
  | "missing_rate";

export interface Usage {
  fuel: "ELECTRICITY" | "GAS";
  /** Yearly kWh (electricity) or MJ (gas). */
  annualUsage: number;
  /** Percent of usage in each time band; must sum to 100. Needed for time-of-use plans. */
  shares?: { peak: number; shoulder: number; offPeak: number };
  controlledLoadAnnualKwh?: number;
  solarExportAnnualKwh?: number;
}

export interface Breakdown {
  supplyCents: number;
  usageCents: number;
  controlledLoadCents: number;
  /** Zero or negative. */
  feedInCreditCents: number;
  /** Zero or negative: guaranteed discounts only. */
  guaranteedDiscountCents: number;
  feesCents: number;
  gstCents: number;
}

export interface ConditionalDiscount {
  name: string;
  condition: string;
  /** Saving in cents (positive) if met; undefined when the amount cannot be worked out. */
  savingCents?: number;
}

export interface PlanRef {
  planId: string;
  retailerSlug: string;
  brandName: string;
  displayName: string;
  planUrl?: string;
  sourceLastUpdated: string;
}

export interface Estimate extends PlanRef {
  estimated: true;
  totalCents: number;
  breakdown: Breakdown;
  conditionalDiscounts: ConditionalDiscount[];
  totalIfConditionsMetCents: number;
  /** Things the published plan has that this estimate leaves out, with the reason. */
  notIncluded: string[];
  notes: string[];
  restrictions: string[];
}

export interface NotEstimated extends PlanRef {
  estimated: false;
  reason: NotEstimatedReason;
  detail: string;
}

const DAYS = 365;
const BLOCK_DAYS: Record<string, number> = { P1D: 1, P1M: DAYS / 12, P3M: DAYS / 4, P1Q: DAYS / 4, P1Y: DAYS };
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

class Stop extends Error {
  constructor(
    readonly reason: NotEstimatedReason,
    readonly detail: string,
  ) {
    super(detail);
  }
}

const ref = (p: EnergyPlan): PlanRef => ({
  planId: p.planId,
  retailerSlug: p.retailerSlug,
  brandName: p.brandName,
  displayName: p.displayName,
  ...(p.planUrl ? { planUrl: p.planUrl } : {}),
  sourceLastUpdated: p.sourceLastUpdated,
});

function dayOfYear(mmdd: string | undefined): number | undefined {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd ?? "");
  if (!m) return undefined;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  if (mo < 1 || mo > 12) return undefined;
  return CUM[mo - 1]! + d;
}

/** Days covered by a seasonal period in a 365-day year (wraps across new year). */
function periodDays(p: TariffPeriod): number {
  const s = dayOfYear(p.startDate);
  const e = dayOfYear(p.endDate);
  if (s === undefined || e === undefined) return DAYS;
  return e >= s ? e - s + 1 : DAYS - s + 1 + e;
}

function blockCharge(rates: Rate[], usagePerWindow: number): number {
  // Returns scaled-money charge for one window of usage.
  const sorted = [...rates].sort((a, b) => (a.volume ?? Infinity) - (b.volume ?? Infinity));
  let left = usagePerWindow;
  let prev = 0;
  let total = 0;
  for (const r of sorted) {
    const cap = r.volume === undefined ? Infinity : Math.max(0, r.volume - prev);
    const used = Math.min(left, cap);
    total += used * r.unitPrice;
    left -= used;
    prev = r.volume ?? prev;
    if (left <= 0) break;
  }
  return total;
}

function singleRateCharge(rates: Rate[], usage: number, days: number): number {
  const first = rates[0];
  if (!first) throw new Stop("missing_rate", "A tariff period has no usage rate.");
  if (rates.length === 1 && first.volume === undefined) return usage * first.unitPrice;
  if (rates.some((r) => r.volume !== undefined && !r.period)) throw new Stop("missing_rate", "A rate block has a threshold but no period.");
  const periods = new Set(rates.filter((r) => r.volume !== undefined).map((r) => r.period));
  if (periods.size > 1) throw new Stop("not_fully_understood", "Rate blocks use mixed periods.");
  const unit = [...periods][0] ?? "P1D";
  const len = BLOCK_DAYS[unit];
  if (!len) throw new Stop("not_fully_understood", `Unknown block period ${unit}.`);
  const windows = days / len;
  return windows * blockCharge(rates, usage / windows);
}

function touCharge(tou: TimeOfUseRate[], usage: number, u: Usage): number {
  if (!u.shares) throw new Stop("needs_time_of_use_split", "This time-of-use plan needs the share of usage in peak, shoulder and off-peak times.");
  const price = (t: TimeOfUseRate): number => {
    if (t.rates.length !== 1 || t.rates[0]!.volume !== undefined) throw new Stop("missing_rate", `Time-of-use rate ${t.type} has blocks, which are not supported yet.`);
    return t.rates[0]!.unitPrice;
  };
  const peak = tou.filter((t) => t.type === "PEAK");
  const off = tou.filter((t) => t.type === "OFF_PEAK");
  const shoulder = tou.filter((t) => /^SHOULDER\d*$/.test(t.type));
  if (peak.length + off.length + shoulder.length !== tou.length) throw new Stop("not_fully_understood", "A time-of-use rate has an unrecognised band.");
  if (peak.length > 1 || off.length > 1 || peak.length + off.length === 0) throw new Stop("not_fully_understood", "Time-of-use bands are not in the expected shape.");
  let peakShare = u.shares.peak;
  const offShare = u.shares.offPeak;
  const shoulderShare = u.shares.shoulder;
  let total = 0;
  if (shoulder.length === 0) peakShare += shoulderShare; // no shoulder band: shoulder usage is charged at peak
  else total += shoulder.reduce((a, t) => a + ((usage * shoulderShare) / 100 / shoulder.length) * price(t), 0);
  if (peak.length) total += ((usage * peakShare) / 100) * price(peak[0]!);
  else if (peakShare > 0) throw new Stop("missing_rate", "The plan has no peak rate for the usage given.");
  if (off.length) total += ((usage * offShare) / 100) * price(off[0]!);
  else if (offShare > 0) throw new Stop("missing_rate", "The plan has no off-peak rate for the usage given.");
  return total;
}

/** Rounds scaled money to whole cents (never returns -0). */
const cents = (scaled: number) => Math.round(scaled / (MONEY_SCALE / 100)) || 0;

function conditionText(d: Discount): string {
  return [d.displayName, d.category && d.category !== "OTHER" ? `(${d.category.toLowerCase().replace(/_/g, " ")})` : undefined, d.description].filter(Boolean).join(" ");
}

export function estimateAnnualCost(plan: EnergyPlan, usage: Usage): Estimate | NotEstimated {
  try {
    return estimate(plan, usage);
  } catch (e) {
    if (e instanceof Stop) return { ...ref(plan), estimated: false, reason: e.reason, detail: e.detail };
    throw e;
  }
}

function estimate(plan: EnergyPlan, u: Usage): Estimate {
  const c: Contract | undefined = u.fuel === "ELECTRICITY" ? plan.electricity : plan.gas;
  if (!c) throw new Stop("missing_rate", `The plan has no ${u.fuel.toLowerCase()} contract.`);
  if (c.gstBasis === "UNKNOWN") throw new Stop("gst_basis_unknown", "Whether the published amounts include GST has not been confirmed.");
  if (!plan.understood) throw new Stop("not_fully_understood", `Parts of this plan are not understood: ${plan.notUnderstood.join(", ")}.`);
  if (c.tariffPeriods.length === 0) throw new Stop("missing_rate", "The plan has no tariff periods.");
  if (c.tariffPeriods.some((t) => t.hasDemandCharges)) throw new Stop("demand_tariff", "The plan has a demand charge, which is not estimated yet.");

  const notes: string[] = [];
  const notIncluded: string[] = [];

  // Supply and usage across (possibly seasonal) tariff periods.
  const raw = c.tariffPeriods.map((t) => ({ t, days: periodDays(t) }));
  const sumDays = raw.reduce((a, x) => a + x.days, 0);
  if (sumDays !== DAYS) notes.push(`Tariff periods cover ${sumDays} days; they were scaled to 365.`);
  let supply = 0;
  let usageCharge = 0;
  for (const { t, days: d0 } of raw) {
    const days = (d0 / sumDays) * DAYS;
    const periodUsage = u.annualUsage * (days / DAYS);
    if (t.dailySupplyCharge === undefined) throw new Stop("missing_rate", "A tariff period has no daily supply charge.");
    supply += t.dailySupplyCharge * days;
    if (t.timeOfUse?.length) usageCharge += touCharge(t.timeOfUse, periodUsage, u);
    else if (t.singleRate?.length) usageCharge += singleRateCharge(t.singleRate, periodUsage, days);
    else throw new Stop("missing_rate", "A tariff period has no usage rate.");
  }

  // Controlled load (electricity only).
  let controlled = 0;
  if (u.controlledLoadAnnualKwh && u.controlledLoadAnnualKwh > 0) {
    if (c.controlledLoads.length === 0) throw new Stop("no_controlled_load_rate", "The plan has no controlled load rate.");
    if (c.controlledLoads.length > 1) throw new Stop("missing_rate", "The plan has several controlled load tariffs; choosing one is not supported yet.");
    const cl = c.controlledLoads[0]!;
    if (!cl.singleRate || cl.singleRate.length !== 1 || cl.singleRate[0]!.volume !== undefined) throw new Stop("no_controlled_load_rate", "The controlled load rate is not a single rate.");
    controlled = u.controlledLoadAnnualKwh * cl.singleRate[0]!.unitPrice + (cl.dailySupplyCharge ?? 0) * DAYS;
  } else if (c.controlledLoads.length) {
    notIncluded.push("Controlled load charges (no controlled load usage was given)");
  }

  // Solar feed-in credit (GST-free).
  let feedIn = 0;
  if (u.solarExportAnnualKwh && u.solarExportAnnualKwh > 0) {
    const fits: FeedIn[] = c.solarFeedIn;
    if (fits.length === 0) {
      notes.push("The plan has no solar feed-in tariff, so no credit was applied.");
    } else {
      const current = fits.filter((f) => f.scheme === "CURRENT");
      const chosen = fits.length === 1 ? fits[0]! : current.length === 1 ? current[0]! : undefined;
      if (!chosen) throw new Stop("missing_rate", "The plan has several feed-in tariffs; choosing one is not supported yet.");
      if (chosen.timeVarying || chosen.rates.length !== 1 || chosen.rates[0]!.volume !== undefined) throw new Stop("missing_rate", "The feed-in tariff varies by time or volume, which is not supported yet.");
      feedIn = -(u.solarExportAnnualKwh * chosen.rates[0]!.unitPrice);
    }
  } else if (c.solarFeedIn.length) {
    notIncluded.push("Solar feed-in credit (no solar export was given)");
  }

  // Discounts.
  const base = supply + usageCharge + controlled;
  let guaranteed = 0;
  const conditional: Array<{ d: Discount; amount: number | undefined }> = [];
  for (const d of c.discounts) {
    const pct = d.percent !== undefined ? Number(d.percent) : undefined;
    let amount: number | undefined;
    if (pct !== undefined && Number.isFinite(pct) && (d.method === "percentOfBill" || d.method === "percentOfUse")) {
      amount = pct * (d.method === "percentOfBill" ? base : usageCharge);
    }
    if (amount === undefined) {
      notIncluded.push(`Discount "${d.displayName ?? d.category ?? "unnamed"}" (its amount cannot be worked out from the published fields)`);
      continue;
    }
    if (d.conditional) conditional.push({ d, amount });
    else guaranteed += amount;
  }

  // Recurring fees only.
  let fees = 0;
  for (const f of c.fees) {
    if (f.type === "MEMBERSHIP" || f.type === "CONTRIBUTION") {
      const times = f.term === "ANNUAL" ? 1 : f.term === "MONTHLY" ? 12 : undefined;
      if (times !== undefined && f.amount !== undefined) {
        fees += f.amount * times;
        continue;
      }
      notIncluded.push(`Fee "${f.type}" (frequency unclear)`);
    } else if (f.type) {
      notIncluded.push(`One-off or conditional fee: ${f.type.toLowerCase().replace(/_/g, " ")}`);
    }
  }

  const build = (extraDiscount: number) => {
    const comp = {
      supplyCents: cents(supply),
      usageCents: cents(usageCharge),
      controlledLoadCents: cents(controlled),
      feedInCreditCents: cents(feedIn),
      guaranteedDiscountCents: -cents(guaranteed + extraDiscount) || 0,
      feesCents: cents(fees),
    };
    const taxableCents = comp.supplyCents + comp.usageCents + comp.controlledLoadCents + comp.guaranteedDiscountCents + comp.feesCents;
    const gstCents = c.gstBasis === "EXCLUSIVE" ? Math.round(taxableCents * 0.1) : 0;
    const total = taxableCents + comp.feedInCreditCents + gstCents;
    return { breakdown: { ...comp, gstCents }, total };
  };

  const main = build(0);
  const allCond = conditional.reduce((a, x) => a + (x.amount ?? 0), 0);
  const met = build(allCond);
  const conditionalDiscounts: ConditionalDiscount[] = conditional.map((x) => ({
    name: x.d.displayName ?? x.d.category ?? "Discount",
    condition: conditionText(x.d),
    ...(x.amount !== undefined ? { savingCents: cents(x.amount) } : {}),
  }));

  return {
    ...ref(plan),
    estimated: true,
    totalCents: main.total,
    breakdown: main.breakdown,
    conditionalDiscounts,
    totalIfConditionsMetCents: met.total,
    notIncluded,
    notes,
    restrictions: plan.electricity || plan.gas ? c.eligibility.map((e) => [e.type, e.information ?? e.description].filter(Boolean).join(": ")).filter(Boolean) : [],
  };
}

export function breakdownSum(b: Breakdown): number {
  return b.supplyCents + b.usageCents + b.controlledLoadCents + b.feedInCreditCents + b.guaranteedDiscountCents + b.feesCents + b.gstCents;
}
