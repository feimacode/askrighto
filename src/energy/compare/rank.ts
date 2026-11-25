import { SEASONS } from "../benchmarks/types.js";
import type { BenchmarkFigure } from "../benchmarks/lookup.js";
import { estimateAnnualCost, type Estimate, type NotEstimated, type Usage, type UsageBasis } from "../calc.js";
import { layoutId, layoutWindows } from "../layouts.js";
import { linkCell, linkNotes, planLink, type PlanLink } from "../links.js";
import type { ReadingsNote } from "../readings.js";
import type { EnergyPlan } from "../types.js";
import { dollars, NOTICE } from "../../tools/energy-common.js";

export const ASSUMPTIONS = [
  "Usage is spread evenly across the year and across each tariff period by its number of days.",
  "A year is 365 days.",
  "Amounts include GST (10%) where the published rates exclude it. Fees are published including GST and solar feed-in credits carry none, so both are used as published.",
  "Conditional discounts (such as pay on time) are not in the ordering cost; each is listed with its condition and the lower cost if it is met.",
];
export const OMISSIONS = [
  "One-off fees (exit, connection, late payment and similar), sign-up credits, concessions and rebates, and green power charges are left out.",
  "Eligibility restrictions are shown beside a plan but not checked against the household.",
];

export interface BenchmarkUsage {
  zone: string;
  zoneLabel: string;
  zoneKind: BenchmarkFigure["zoneKind"];
  state: string;
  householdSize: number;
  fiveOrMore: boolean;
  seasons: Record<string, number>;
  annual: number;
  unit: "kWh" | "MJ";
  source: BenchmarkFigure["source"];
  attribution: string;
  release: string;
  releaseDate: string;
}

export const BUSINESS_ASSUMPTIONS = [
  "These are business plans, compared only with business plans. Amounts include GST; the breakdown shows the GST separately, so a business that can claim GST credits can compare the amounts without it. Eligibility conditions (for example a small-business limit) are shown beside a plan but not checked.",
];

export const READINGS_OMISSIONS = [
  "Controlled load is not costed separately: every E stream in the readings is counted as main consumption, so a controlled load circuit is costed at the general rate.",
  "Solar feed-in credit uses the plan's single feed-in rate; a time-varying or capped feed-in is listed as not estimated.",
];
/** Said whenever a readings profile did not come, unchanged, from this server. */
export const UNVERIFIED_READINGS =
  "These readings were summarised by the assistant, not by Ask Righto, so the figures are not verified by Ask Righto (the profile was built or changed outside our tool).";

export const READINGS_ASSUMPTIONS = [
  "Time-of-use shares come from the household's own half-hourly readings, matched to each plan's windows in local clock time (daylight saving applied); public holidays are treated as ordinary days.",
  "Annual use is the measured total scaled to 365 days, and is spread evenly across tariff periods.",
];

export const BENCHMARK_OMISSIONS = [
  "Solar export and controlled load are not included: typical usage has no export or controlled load figure, so no feed-in credit or controlled load charge is worked out.",
  "Time-of-use plans are not estimated: they need the peak, shoulder and off-peak split from a bill.",
];

/** Short form for the Inkview caption, which is capped at 300 characters (the full notice leads the text and sits in the data). */
export function typicalCaption(size: number, fiveOrMore: boolean): string {
  return `Typical usage for a household of ${fiveOrMore ? "5 or more" : size}, not your own.`;
}

export function typicalNotice(f: Pick<BenchmarkFigure, "householdSize" | "fiveOrMore" | "zoneLabel" | "state" | "unit" | "annual" | "releaseLabel">): string {
  const size = f.fiveOrMore ? "5 or more" : String(f.householdSize);
  return `Typical usage for a household of ${size} in ${f.zoneLabel} (${f.state}), not your own: ${Math.round(f.annual).toLocaleString("en-AU")} ${f.unit} a year, the AER benchmark (${f.releaseLabel}). Real cost can differ a lot from these estimates.`;
}

export interface IfConditionsMet {
  rank: number;
  /** The plan's place in the main ordering (cost without conditions). */
  mainRank: number;
  planId: string;
  brandName: string;
  displayName: string;
  planUrl?: string;
  link: PlanLink;
  totalIfConditionsMetCents: number;
  totalCents: number;
  savingCents: number;
  conditions: Estimate["conditionalDiscounts"];
}

export interface CompareData {
  postcode: string;
  customerType: "RESIDENTIAL" | "BUSINESS";
  fuelType: string;
  distributor?: string;
  matchedRetailer?: string;
  usage: {
    annualUsage: number;
    unit: "kWh" | "MJ";
    /** "customer" is the person's own figure; "benchmark" is the AER's typical-household figure. */
    basis: UsageBasis;
    scaledFromBill?: string;
    shares?: Usage["shares"];
    /** Present only when basis is "readings". */
    readings?: { verified: boolean; from: string; to: string; daysPresent: number; missingCount: number; missingDates: string[]; streams: { consumption: string[]; export: string[] }; netOnly: boolean; ignored?: string };
    controlledLoadAnnualKwh?: number;
    solarExportAnnualKwh?: number;
    /** Present only when basis is "benchmark". */
    benchmark?: BenchmarkUsage;
  };
  /** Present only for benchmark usage: shown before the figures in every output form. */
  typicalUsageNotice?: string;
  /** Present only for usage from the household's own readings: shown before the figures. */
  readingsNotice?: string;
  /** Present for electricity results from a benchmark or a single bill: where to ask for interval readings. */
  readingsNote?: ReadingsNote;
  counts: { available: number; estimated: number; notEstimated: number; returned: number; approximate: number };
  summary: string;
  estimates: Array<Estimate & { rank: number; link: PlanLink }>;
  /**
   * The plans with conditional discounts, ordered by their cost if every listed condition is met.
   * A separate ranking, so the main ordering stays on the cost without conditions.
   */
  ifConditionsMet: IfConditionsMet[];
  /** Time-of-use estimates made with a bill split whose hours differ from, or may differ from, the household's current plan. Never ranked with the exact ones. */
  approximateHours: Array<Estimate & { rank: number; link: PlanLink; hours: "different" | "unknown"; hoursNote: string }>;
  /** Present when a bill split was used: whether the household's own hours were known. */
  hoursBasis?: { known: boolean; layoutId?: string; description?: string; from?: string };
  notEstimated: NotEstimated[];
  notEstimatedByReason: Record<string, number>;
  unknownPlanIds?: string[];
  assumptions: string[];
  omissions: string[];
  notice: string;
}

export interface Ranked {
  allOk: Estimate[];
  ok: Estimate[];
  approxAll: Estimate[];
  no: NotEstimated[];
  byReason: Record<string, number>;
  shown: CompareData["estimates"];
  approximateHours: CompareData["approximateHours"];
  ifConditionsMet: IfConditionsMet[];
}

/** Costs every plan for the usage, then orders the exact, approximate and conditional-discount tables. No store access. */
export function rank(plans: EnergyPlan[], usage: Usage, opts: { fuelType: string; postcode: string; hoursBasis?: CompareData["hoursBasis"]; limit: number }): Ranked {
  const { hoursBasis, limit, postcode } = opts;
  const results = plans.map((p) => estimateAnnualCost(p, usage));
  // With a bill split, a time-of-use estimate is exact only for plans whose band hours equal the household's own.
  const hoursOf = (e: Estimate): "same" | "different" | "unknown" | undefined => {
    if (!hoursBasis) return undefined;
    const p = plans.find((x) => x.planId === e.planId);
    const w = p ? layoutWindows(p, opts.fuelType as "ELECTRICITY" | "GAS") : undefined;
    if (!w) return undefined;
    if (!hoursBasis.known) return "unknown";
    return layoutId(w) === hoursBasis.layoutId ? "same" : "different";
  };
  const allOk = results.filter((r): r is Estimate => r.estimated).sort((a, b) => a.totalCents - b.totalCents || a.brandName.localeCompare(b.brandName) || a.planId.localeCompare(b.planId));
  const ok = allOk.filter((e) => { const h = hoursOf(e); return h === undefined || h === "same"; });
  const approxAll = allOk.filter((e) => { const h = hoursOf(e); return h === "different" || h === "unknown"; });
  const no = results.filter((r): r is NotEstimated => !r.estimated).sort((a, b) => a.reason.localeCompare(b.reason) || a.brandName.localeCompare(b.brandName) || a.planId.localeCompare(b.planId));
  const byReason: Record<string, number> = {};
  for (const n of no) byReason[n.reason] = (byReason[n.reason] ?? 0) + 1;
  const shown = ok.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1, link: planLink(e, postcode) }));
  const approximateHours = approxAll.slice(0, limit).map((e, i) => {
    const h = hoursOf(e) as "different" | "unknown";
    return {
      ...e,
      rank: i + 1,
      link: planLink(e, postcode),
      hours: h,
      hoursNote: h === "different" ? "approximate: different hours (the bill split describes the household's current plan, whose peak, shoulder and off-peak hours differ from this plan's)" : "approximate: the household's own hours are unknown, so the split may not fit this plan's hours",
    };
  });
  const ifConditionsMet: IfConditionsMet[] = ok
    .map((e, i) => ({ e, mainRank: i + 1 }))
    .filter(({ e }) => e.conditionalDiscounts.length > 0)
    .sort((a, b) => a.e.totalIfConditionsMetCents - b.e.totalIfConditionsMetCents || a.mainRank - b.mainRank)
    .slice(0, limit)
    .map(({ e, mainRank }, i) => ({
      rank: i + 1,
      mainRank,
      planId: e.planId,
      brandName: e.brandName,
      displayName: e.displayName,
      ...(e.planUrl ? { planUrl: e.planUrl } : {}),
      link: planLink(e, postcode),
      totalIfConditionsMetCents: e.totalIfConditionsMetCents,
      totalCents: e.totalCents,
      savingCents: e.totalCents - e.totalIfConditionsMetCents,
      conditions: e.conditionalDiscounts,
    }));
  return { allOk, ok, approxAll, no, byReason, shown, approximateHours, ifConditionsMet };
}

export function renderCompare(d: CompareData): string {
  const u = d.usage;
  const out = [
    ...(d.typicalUsageNotice ? [d.typicalUsageNotice, ""] : []),
    ...(d.readingsNotice ? [d.readingsNotice, ...(u.readings?.ignored ? [u.readings.ignored] : []), ""] : []),
    d.summary,
    "",
    `Usage assumed${u.basis === "benchmark" ? " (typical, AER benchmark)" : u.basis === "readings" ? " (the household's own interval readings)" : ""}: ${u.annualUsage} ${u.unit} a year${u.benchmark ? ` (${SEASONS.map((x) => `${x.toLowerCase()} ${Math.round(u.benchmark!.seasons[x.toLowerCase()]!)}`).join(", ")} ${u.unit})` : ""}${u.scaledFromBill ? ` (${u.scaledFromBill})` : ""}${u.shares ? `; peak ${u.shares.peak}%, shoulder ${u.shares.shoulder}%, off-peak ${u.shares.offPeak}%` : ""}${u.controlledLoadAnnualKwh ? `; controlled load ${u.controlledLoadAnnualKwh} kWh` : ""}${u.solarExportAnnualKwh ? `; solar export ${u.solarExportAnnualKwh} kWh` : ""}${d.distributor ? `; distributor ${d.distributor}` : ""}; ${d.customerType.toLowerCase()} plans only.`,
    "",
  ];
  if (u.benchmark) out.push(`Benchmark source: ${u.benchmark.source.name} (${u.benchmark.source.url}), ${u.benchmark.release}. ${u.benchmark.source.licence}.`, "");
  if (d.estimates.length) {
    out.push(
      "| # | Retailer | Plan | Est. yearly cost | Supply | Usage | Controlled load | Solar credit | Updated | Link |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...d.estimates.map(
        (e) =>
          `| ${e.rank} | ${e.brandName} | ${e.displayName} | ${dollars(e.totalCents)} | ${dollars(e.breakdown.supplyCents)} | ${dollars(e.breakdown.usageCents)} | ${dollars(e.breakdown.controlledLoadCents)} | ${dollars(e.breakdown.feedInCreditCents)} | ${e.sourceLastUpdated.slice(0, 10)} | ${linkCell(e.link)} |`,
      ),
      "",
      "Breakdown per plan also includes guaranteed discounts, recurring fees and GST; each plan's components add up to its total.",
      ...(d.readingsNote ? ["", `**More accurate comparison.** ${d.readingsNote.text}`] : []),
    );
    for (const e of d.estimates) {
      const extra = [
        ...e.restrictions.map((r) => `restriction: ${r}`),
        ...e.notes,
        ...e.notIncluded.map((n) => `not included: ${n}`),
      ];
      if (extra.length) out.push(`- #${e.rank} ${e.brandName} ${e.displayName}: ${extra.join("; ")}`);
    }
  }
  if (d.hoursBasis) {
    out.push("", d.hoursBasis.known ? `Band hours: the split is applied exactly only to plans with the same hours as ${d.hoursBasis.from ?? "the layout the user chose"}${d.hoursBasis.description ? ` (${d.hoursBasis.description})` : ""}.` : "Band hours: the household's own hours are not known, so every time-of-use estimate from a bill split is approximate.");
  }
  if (d.approximateHours.length) {
    out.push(
      "",
      "Approximate (different or unknown hours): a bill's peak, shoulder and off-peak split describes use against the household's current plan's hours. These plans have other hours, so their estimates may be wrong either way. They are not ranked with the table above.",
      "",
      "| # | Retailer | Plan | Est. yearly cost (approx.) | Why approximate | Link |",
      "| --- | --- | --- | --- | --- | --- |",
      ...d.approximateHours.map((e) => `| ${e.rank} | ${e.brandName} | ${e.displayName} | ${dollars(e.totalCents)} | ${e.hoursNote} | ${linkCell(e.link)} |`),
    );
  }
  if (d.ifConditionsMet.length) {
    out.push(
      "",
      "If you meet the conditions: these plans have discounts that apply only when a condition is met (for example paying on time, direct debit or membership). This table orders them by the cost if every listed condition is met. It is a separate ordering; the table above does not count these discounts.",
      "",
      "| # | Retailer | Plan | Cost if conditions met | Cost otherwise | Difference | Conditions | Link |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...d.ifConditionsMet.map(
        (x) =>
          `| ${x.rank} | ${x.brandName} | ${x.displayName} | ${dollars(x.totalIfConditionsMetCents)} | ${dollars(x.totalCents)} (#${x.mainRank} without conditions) | ${dollars(x.savingCents)} | ${x.conditions.map((c) => `${c.name}: ${c.condition}`.replace(/\|/g, "/")).join("; ")} | ${linkCell(x.link)} |`,
      ),
    );
  }
  if (d.counts.notEstimated) {
    out.push("", `Not estimated (${d.counts.notEstimated}): ${Object.entries(d.notEstimatedByReason).map(([r, n]) => `${n} ${r}`).join(", ")}.`);
    for (const n of d.notEstimated.slice(0, 15)) out.push(`- ${n.brandName} ${n.displayName} (${n.planId}): ${n.reason}. ${n.detail}`);
    if (d.notEstimated.length > 15) out.push(`- and ${d.counts.notEstimated - 15} more (see structured data).`);
  }
  if (d.unknownPlanIds?.length) out.push("", `Plan ids not found among the available plans: ${d.unknownPlanIds.join(", ")}.`);
  out.push("", ...linkNotes(d.estimates.map((e) => e.link)), "", "Assumptions:", ...d.assumptions.map((a) => `- ${a}`), "Left out:", ...d.omissions.map((a) => `- ${a}`), "", NOTICE);
  return out.join("\n");
}
