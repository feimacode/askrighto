import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { staleWarnings } from "../core/registry.js";
import { attributionFor, availability } from "../core/rights.js";
import { lookupBenchmark, type BenchmarkFigure } from "../energy/benchmarks/lookup.js";
import { NoBenchmarkLoad } from "../energy/benchmarks/load.js";
import { SEASONS } from "../energy/benchmarks/types.js";
import { readingsNote, type ReadingsNote } from "../energy/readings.js";
import { stateOfPostcode } from "../energy/benchmarks/state.js";
import { annualExportKwh, annualKwh, decodeProfile, MAX_PROFILE_CHARS, type ReadingsProfile } from "../energy/readings/profile.js";
import { bandShares, periodMonths } from "../energy/readings/windows.js";
import { estimateAnnualCost, type Estimate, type NotEstimated, type Usage, type UsageBasis } from "../energy/calc.js";
import { BENCHMARK_DATASET_ID, ENERGY_DATASET_ID, getEnergy, withStore } from "../energy/index.js";
import { describeLayout, layoutId, layoutWindows } from "../energy/layouts.js";
import { linkCell, linkNotes, planLink, type PlanLink } from "../energy/links.js";
import {
  asOfFor, badPostcode, checkPostcode, COVERAGE_STATES, dollars, inkview, inkviewResult, inkviewSource, matchRetailer, NOTICE, source, tableMeta, uniqueDistributors,
} from "./energy-common.js";

const input = z.object({
  postcode: z.string().describe("Four-digit Australian postcode of the property, e.g. 3000"),
  customerType: z.enum(["RESIDENTIAL", "BUSINESS"]).optional().describe("Whose plans: RESIDENTIAL (a home, the default) or BUSINESS (small business; large customers are not compared). Ask the user which; never assume. A business is only compared with business plans and a household with residential plans"),
  fuelType: z.enum(["ELECTRICITY", "GAS"]).describe("Which fuel to compare"),
  annualUsageKwh: z.number().positive().max(1_000_000).optional().describe("Electricity used in a year, in kWh"),
  billUsageKwh: z.number().positive().max(1_000_000).optional().describe("Electricity used in one bill period, in kWh. Give billDays too"),
  annualUsageMj: z.number().positive().max(10_000_000).optional().describe("Gas used in a year, in MJ"),
  billUsageMj: z.number().positive().max(10_000_000).optional().describe("Gas used in one bill period, in MJ. Give billDays too"),
  billDays: z.number().int().min(1).max(400).optional().describe("Number of days the bill covers"),
  peakSharePct: z.number().min(0).max(100).optional().describe("Percent of electricity used at peak times, from the bill. Needed for time-of-use plans"),
  shoulderSharePct: z.number().min(0).max(100).optional().describe("Percent used at shoulder times (0 if none)"),
  offPeakSharePct: z.number().min(0).max(100).optional().describe("Percent used at off-peak times"),
  householdSize: z.number().int().min(1).max(5).optional().describe("Number of people in the household, 1 to 5 (5 means five or more). Only used with useBenchmarkUsage"),
  useBenchmarkUsage: z.boolean().optional().describe("Set true only when the user has no bill figures and agrees to typical usage for a household of their size. Needs householdSize. Ignored if usage is given"),
  readingsProfile: z.string().max(MAX_PROFILE_CHARS).optional().describe("The profile string returned by summarise_interval_readings, passed unchanged. Uses the household's own half-hourly readings, which also lets time-of-use plans be estimated. Takes the place of bill figures"),
  currentPlanId: z.string().max(80).optional().describe("The plan id the household is on now, taken from the option the user picked in list_current_plan_options. With a peak, shoulder and off-peak split, only plans with the same band hours as this plan are estimated exactly; other time-of-use plans are labelled approximate and listed apart"),
  hoursLayoutId: z.string().max(16).optional().describe("The band-hours layout id the user picked in list_current_plan_options when their plan was not listed. Used like currentPlanId. Give one or the other, not both"),
  controlledLoadAnnualKwh: z.number().min(0).max(1_000_000).optional().describe("Yearly controlled load kWh (for example a hot water system), if the household has one"),
  solarExportAnnualKwh: z.number().min(0).max(1_000_000).optional().describe("Yearly kWh exported to the grid by solar panels, if any"),
  distributor: z.string().optional().describe("Distribution network from the user's bill, required when the postcode has several"),
  retailer: z.string().optional().describe("Only compare this retailer's plans"),
  planType: z.enum(["MARKET", "STANDING", "REGULATED"]).optional().describe("Plan type"),
  planIds: z.array(z.string()).max(25).optional().describe("Compare only these plan ids"),
  limit: z.number().int().min(1).max(25).optional().describe("Estimates to return, default 10, maximum 25"),
});

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

export const compareEnergyPlans = defineTool({
  name: "compare_energy_plans",
  title: "Compare energy plan costs",
  description:
    "Estimates the yearly cost of the current energy plans at a postcode for the usage the user gives (kWh or MJ from a recent bill), ordered from the lowest estimate to the highest, with a cost breakdown, conditional discounts and the plans that cannot be estimated. Needs usage figures; time-of-use plans also need the peak, shoulder and off-peak split from the bill. Only if the user has no bill, and agrees, set useBenchmarkUsage with householdSize to use the AER's typical household use instead; the result is then labelled typical usage, not theirs, and time-of-use plans are not estimated. If the user has interval readings, call summarise_interval_readings first and pass its profile as readingsProfile: usage then comes from their own half-hourly readings and time-of-use plans are estimated. Estimates only, not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("data_table"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const customerType = args.customerType ?? "RESIDENTIAL";
    const elec = args.fuelType === "ELECTRICITY";
    const annualDirect = elec ? args.annualUsageKwh : args.annualUsageMj;
    const bill = elec ? args.billUsageKwh : args.billUsageMj;
    const unit = elec ? "kWh" : "MJ";
    let annual = annualDirect;
    let scaledFromBill: string | undefined;
    // The household's own interval readings, if the host passed a profile back. Revalidated here, never trusted.
    let profile: ReadingsProfile | undefined;
    let ignored: string | undefined;
    let readingsVerified = true;
    if (args.readingsProfile !== undefined) {
      if (!elec) return notFound("needs_input", "Interval readings apply to electricity only. Call again with fuelType ELECTRICITY, or without readingsProfile.");
      const d = decodeProfile(args.readingsProfile);
      if (!d.ok) return notFound("needs_input", `The readings profile could not be used: ${d.problem}. Ask the user for their readings file and call summarise_interval_readings again, then pass its profile unchanged.`);
      const st = stateOfPostcode(postcode);
      if (st !== d.profile.state) return notFound("needs_input", `The profile was built for a ${d.profile.state} postcode (daylight saving is applied by state) but this postcode is in ${st ?? "an unsupported place"}. Call summarise_interval_readings again with this postcode.`);
      profile = d.profile;
      readingsVerified = d.verified;
      const dropped = [annualDirect !== undefined || bill !== undefined ? "the bill or yearly usage figure" : "", args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined ? "the peak, shoulder and off-peak split" : ""].filter(Boolean);
      if (dropped.length) ignored = `The readings were used; ${dropped.join(" and ")} given with them was not used.`;
      annual = annualKwh(profile);
    }
    if (!profile && annual === undefined && bill !== undefined) {
      if (!args.billDays) return notFound("needs_input", `A bill's ${unit} figure needs the number of days the bill covers. Ask the user for billDays.`);
      annual = (bill * 365) / args.billDays;
      scaledFromBill = `${bill} ${unit} over ${args.billDays} days scaled to a year (x 365/${args.billDays}); real use varies with the seasons`;
    }
    if (annual === undefined) {
      if (!args.useBenchmarkUsage) {
        return notFound(
          "needs_input",
          `No usage was given. Ask the user for the ${unit} used and the number of days from a recent bill (or their yearly ${unit}), then call again. ${customerType === "BUSINESS" ? "There is no typical usage for a business: if there is no bill, ask for interval readings or a bill." : "If they have no bill to hand, you may offer typical usage for a household of their size: ask how many people live there (1 to 5, 5 meaning five or more), then call again with useBenchmarkUsage true and householdSize, and say it is typical usage, not their own."}`,
        );
      }
      if (customerType === "BUSINESS") return notFound("needs_input", "Typical usage is for households only: there is no benchmark for a business. Ask the user for the usage on a recent bill, or their interval readings, then call again.");
      if (args.householdSize === undefined) return notFound("needs_input", "Typical usage needs the household size. Ask the user how many people live there (1 to 5, 5 meaning five or more), then call again with householdSize.");
      if (args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined || args.controlledLoadAnnualKwh || args.solarExportAnnualKwh) {
        return notFound("needs_input", "Peak and off-peak shares, controlled load and solar export come from a bill and cannot be combined with typical usage. Ask the user for the usage on a recent bill, or call again without those figures.");
      }
    }
    const useBenchmark = annual === undefined;
    let shares: Usage["shares"];
    if (!useBenchmark && !profile && (args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined)) {
      if (!elec) return notFound("needs_input", "Peak and off-peak shares apply to electricity only.");
      shares = { peak: args.peakSharePct ?? 0, shoulder: args.shoulderSharePct ?? 0, offPeak: args.offPeakSharePct ?? 0 };
      const sum = shares.peak + shares.shoulder + shares.offPeak;
      if (Math.abs(sum - 100) > 0.5) return notFound("needs_input", `The peak, shoulder and off-peak shares add up to ${sum}%, not 100%. Ask the user to check the split on their bill.`);
    }
    const buildUsage = (annualUsage: number, basis: UsageBasis): Usage => ({
      fuel: args.fuelType,
      annualUsage,
      basis,
      ...(shares ? { shares } : {}),
      ...(basis === "customer" && elec && args.controlledLoadAnnualKwh ? { controlledLoadAnnualKwh: args.controlledLoadAnnualKwh } : {}),
      ...(basis === "customer" && elec && args.solarExportAnnualKwh ? { solarExportAnnualKwh: args.solarExportAnnualKwh } : {}),
    });

    return withStore<CompareData>(async (store) => {
      // Typical usage: look the AER benchmark up first, so a postcode outside it makes no estimate.
      let figure: BenchmarkFigure | undefined;
      if (useBenchmark) {
        const avail = availability(BENCHMARK_DATASET_ID);
        if (!avail.servable) return notFound("data_unavailable", `Typical usage is not available yet. ${avail.reason}`, { dataset: BENCHMARK_DATASET_ID });
        const src = getEnergy()?.benchmarks;
        if (!src) return notFound("data_unavailable", "The typical-usage benchmark data is not configured on this server. Ask the user for the usage on a recent bill instead.");
        try {
          const look = lookupBenchmark(await src.data(), { postcode, fuel: args.fuelType, householdSize: args.householdSize! });
          if (!look.ok) return notFound(look.reason, look.detail);
          figure = look.figure;
        } catch (e) {
          if (e instanceof NoBenchmarkLoad) return notFound("data_unavailable", "The typical-usage benchmark data has not been loaded on this server yet. Ask the user for the usage on a recent bill instead.");
          throw e;
        }
      }
      if (figure) annual = figure.annual;
      const usage = buildUsage(annual!, profile ? "readings" : figure ? "benchmark" : "customer");
      if (profile) {
        const pr = profile;
        usage.sharesFor = (t) => {
          const r = bandShares(pr, t.timeOfUse ?? [], periodMonths(t));
          return r.ok ? { ok: true, shares: r.byBand } : { ok: false, reason: r.reason };
        };
        const ex = annualExportKwh(pr) ?? args.solarExportAnnualKwh;
        if (ex) usage.solarExportAnnualKwh = ex;
        if (args.controlledLoadAnnualKwh) usage.controlledLoadAnnualKwh = args.controlledLoadAnnualKwh;
      }

      // The household's own band hours, to decide which time-of-use estimates a bill split fits exactly.
      let hoursBasis: CompareData["hoursBasis"];
      if (shares && !profile && !figure) {
        if (args.currentPlanId && args.hoursLayoutId) return notFound("needs_input", "Give currentPlanId or hoursLayoutId, not both. Ask the user which they picked in list_current_plan_options.");
        if (args.currentPlanId) {
          const cur = await store.plan(args.currentPlanId);
          if (!cur) return notFound("needs_input", `currentPlanId ${args.currentPlanId} was not found. Call list_current_plan_options again and pass the plan id of the option the user picked.`);
          const w = layoutWindows(cur, args.fuelType);
          hoursBasis = w ? { known: true, layoutId: layoutId(w), description: describeLayout(w), from: `${cur.brandName} ${cur.displayName}` } : { known: false };
        } else if (args.hoursLayoutId) {
          hoursBasis = { known: true, layoutId: args.hoursLayoutId };
        } else {
          hoursBasis = { known: false };
        }
      }

      let plans = (await store.plans({ postcode, customerType })).filter((p) => p.fuelType === args.fuelType || p.fuelType === "DUAL");
      if (plans.length === 0) return notFound("outside_coverage", `No ${args.fuelType.toLowerCase()} plans are stored for postcode ${postcode}. The data covers ${COVERAGE_STATES}.`, { states: COVERAGE_STATES });

      // Network tariffs differ, so a mixed-network ranking would mislead. Distributors come from single-fuel plans.
      const nets = uniqueDistributors(plans.filter((p) => p.fuelType === args.fuelType).flatMap((p) => p.geography.distributors));
      let distributor = args.distributor;
      if (distributor) {
        const match = nets.find((n) => n.toLowerCase() === distributor!.toLowerCase());
        if (nets.length && !match) return notFound("needs_input", `"${distributor}" is not a distributor for this postcode. Ask the user which one is on their bill.`, { distributors: nets });
        distributor = match ?? distributor;
        plans = plans.filter((p) => p.geography.distributors.some((x) => x.toLowerCase() === distributor!.toLowerCase()));
      } else if (nets.length > 1) {
        return notFound("needs_input", "This postcode has more than one distributor, and costs differ by network. Ask the user which distributor is on their bill, then call again with distributor.", { distributors: nets });
      }

      let matchedRetailer: string | undefined;
      if (args.retailer) {
        const m = matchRetailer(plans, args.retailer);
        if (!m) return notFound("not_in_dataset", `No retailer matching "${args.retailer}" has ${args.fuelType.toLowerCase()} plans here.`);
        if ("candidates" in m) return notFound("needs_input", `"${args.retailer}" could match more than one retailer. Ask the user which one they mean.`, { candidates: m.candidates.map((c) => c.brandName) });
        matchedRetailer = m.brandName;
        plans = plans.filter((p) => p.brandName === m.brandName);
      }
      if (args.planType) plans = plans.filter((p) => p.planType === args.planType);
      let unknownPlanIds: string[] | undefined;
      if (args.planIds?.length) {
        const have = new Set(plans.map((p) => p.planId));
        unknownPlanIds = args.planIds.filter((id) => !have.has(id));
        const want = new Set(args.planIds);
        plans = plans.filter((p) => want.has(p.planId));
      }
      if (plans.length === 0) return notFound("not_in_dataset", "No plans match those filters.", unknownPlanIds ? { unknownPlanIds } : undefined);

      const results = plans.map((p) => estimateAnnualCost(p, usage));
      // With a bill split, a time-of-use estimate is exact only for plans whose band hours equal the household's own.
      const hoursOf = (e: Estimate): "same" | "different" | "unknown" | undefined => {
        if (!hoursBasis) return undefined;
        const p = plans.find((x) => x.planId === e.planId);
        const w = p ? layoutWindows(p, args.fuelType) : undefined;
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
      const limit = args.limit ?? 10;
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
      const first = shown[0];
      const typicalUsageNotice = figure ? typicalNotice(figure) : undefined;
      const readingsNotice = profile
        ? `Usage is from the household's own interval readings, ${profile.from} to ${profile.to}: ${profile.daysPresent} days present${profile.missingCount ? `, ${profile.missingCount} missing` : ""}, scaled to a year (${Math.round(annual!)} kWh). Time-of-use plans are matched to the half-hourly readings. ${profile.daysPresent + profile.missingCount < 90 ? `The readings cover only ${profile.daysPresent + profile.missingCount} days, so this is a rough scale-up: say so, and if the user's file is longer, ask for a comparison from the whole file. ` : ""}This rests on one past year of use, which may not repeat.${readingsVerified ? "" : ` ${UNVERIFIED_READINGS}`}`
        : undefined;
      // Interval readings would be more accurate than a benchmark or one bill (electricity only; gas has no interval data here).
      const note = elec && (figure || scaledFromBill) ? readingsNote(distributor ?? (nets.length === 1 ? nets[0] : undefined)) : undefined;
      const summary = first
        ? `Of ${plans.length} plan${plans.length === 1 ? "" : "s"} available, ${allOk.length} could be estimated${approxAll.length ? ` (${approxAll.length} only approximately, listed apart)` : ""} and ${no.length} could not. The lowest estimate for ${figure ? "typical usage (not the household's own)" : profile ? "the household's own readings" : "the usage given"} is ${dollars(first.totalCents)} a year (${first.brandName}, ${first.displayName}); this ordering is by estimated cost only.`
        : approxAll.length
          ? `Of ${plans.length} plans available, ${approxAll.length} time-of-use plans could be estimated only approximately because the household's own hours ${hoursBasis?.known ? "differ from theirs" : "are not known"}; none matched exactly.`
          : `Of ${plans.length} plan${plans.length === 1 ? "" : "s"} available, none could be estimated with the information given.`;
      const data: CompareData = {
        postcode,
        customerType,
        fuelType: args.fuelType,
        ...(distributor ? { distributor } : {}),
        ...(matchedRetailer ? { matchedRetailer } : {}),
        usage: {
          annualUsage: Math.round(annual!),
          unit,
          basis: usage.basis ?? "customer",
          ...(scaledFromBill ? { scaledFromBill } : {}),
          ...(profile ? { readings: { verified: readingsVerified, from: profile.from, to: profile.to, daysPresent: profile.daysPresent, missingCount: profile.missingCount, missingDates: profile.missing, streams: profile.streams, netOnly: profile.netOnly, ...(ignored ? { ignored } : {}) } } : {}),
          ...(shares ? { shares } : {}),
          ...(usage.controlledLoadAnnualKwh ? { controlledLoadAnnualKwh: usage.controlledLoadAnnualKwh } : {}),
          ...(usage.solarExportAnnualKwh ? { solarExportAnnualKwh: usage.solarExportAnnualKwh } : {}),
          ...(figure
            ? {
                benchmark: {
                  zone: figure.zone,
                  zoneLabel: figure.zoneLabel,
                  zoneKind: figure.zoneKind,
                  state: figure.state,
                  householdSize: figure.householdSize,
                  fiveOrMore: figure.fiveOrMore,
                  seasons: Object.fromEntries(SEASONS.map((x) => [x.toLowerCase(), figure.seasons[x]])),
                  annual: figure.annual,
                  unit: figure.unit,
                  source: figure.source,
                  attribution: figure.attribution,
                  release: figure.releaseLabel,
                  releaseDate: figure.releaseDate.toISOString().slice(0, 10),
                },
              }
            : {}),
        },
        ...(typicalUsageNotice ? { typicalUsageNotice } : {}),
        ...(readingsNotice ? { readingsNotice } : {}),
        ...(note ? { readingsNote: note } : {}),
        counts: { available: plans.length, estimated: allOk.length, notEstimated: no.length, returned: shown.length, approximate: approxAll.length },
        approximateHours,
        ...(hoursBasis ? { hoursBasis } : {}),
        summary,
        estimates: shown,
        ifConditionsMet,
        notEstimated: no.slice(0, 50),
        notEstimatedByReason: byReason,
        ...(unknownPlanIds?.length ? { unknownPlanIds } : {}),
        assumptions: [...(profile ? [...ASSUMPTIONS, ...READINGS_ASSUMPTIONS] : ASSUMPTIONS), ...(customerType === "BUSINESS" ? BUSINESS_ASSUMPTIONS : [])],
        omissions: figure ? [...BENCHMARK_OMISSIONS, ...OMISSIONS] : profile ? [...READINGS_OMISSIONS, ...OMISSIONS] : OMISSIONS,
        notice: NOTICE,
      };
      if (!figure) return found({ data, source, asOf: asOfFor(plans) });
      const attribution = [attributionFor([ENERGY_DATASET_ID]), figure.attribution].filter(Boolean).join(" ");
      const a = availability(BENCHMARK_DATASET_ID);
      const warnings = [...staleWarnings([BENCHMARK_DATASET_ID]), ...(a.servable && a.warning ? [a.warning] : [])];
      return found({ data, source: { ...source, attribution }, asOf: asOfFor(plans), ...(warnings.length ? { warnings } : {}) });
    });
  },
  render: (d) => {
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
  },
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CompareData>;
      return inkview.table(
        {
          title: `Estimated yearly cost${r.data.usage.basis === "benchmark" ? " at typical usage" : ""}, ${r.data.fuelType.toLowerCase()}, postcode ${r.data.postcode}`,
          caption: r.data.usage.benchmark ? `${typicalCaption(r.data.usage.benchmark.householdSize, r.data.usage.benchmark.fiveOrMore)} ${NOTICE}` : NOTICE,
          columns: [
            { key: "rank", label: "#", type: "number" },
            { key: "retailer", label: "Retailer" },
            { key: "plan", label: "Plan" },
            { key: "total", label: "Est. yearly cost", type: "money", currency: "AUD" },
            { key: "supply", label: "Supply", type: "money", currency: "AUD" },
            { key: "usage", label: "Usage", type: "money", currency: "AUD" },
            { key: "ifMet", label: "Cost if conditions met", type: "money", currency: "AUD" },
            { key: "conditions", label: "Conditions" },
            { key: "updated", label: "Updated", type: "date" },
            { key: "linkLabel", label: "Link type" },
            { key: "link", label: "Link", type: "link" },
          ],
          rows: r.data.estimates.map((e) => ({
            rank: e.rank,
            retailer: e.brandName,
            plan: e.displayName,
            total: e.totalCents / 100,
            supply: e.breakdown.supplyCents / 100,
            usage: e.breakdown.usageCents / 100,
            ifMet: e.conditionalDiscounts.length ? e.totalIfConditionsMetCents / 100 : null,
            conditions: e.conditionalDiscounts.map((c) => c.name).join("; ") || null,
            updated: e.sourceLastUpdated.slice(0, 10),
            linkLabel: e.link.url ? e.link.label : "No link available",
            link: e.link.url ?? null,
          })),
          source: inkviewSource(r),
          // The caption is capped at 300 characters, so the readings note rides in a footnote the table carries.
          ...(r.data.counts.approximate ? { footnote: `${r.data.counts.approximate} time-of-use plans were estimated only approximately because their hours differ from, or may differ from, the household's own; they are not in this table (see the full result).` } : r.data.readingsNote ? { footnote: r.data.readingsNote.text } : {}),
        },
        { limit: 50 },
      );
    }, { rowsKey: "estimates" }),
});
