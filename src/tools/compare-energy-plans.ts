import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { staleWarnings } from "../core/registry.js";
import { attributionFor, availability } from "../core/rights.js";
import { lookupBenchmark, type BenchmarkFigure } from "../energy/benchmarks/lookup.js";
import { NoBenchmarkLoad } from "../energy/benchmarks/load.js";
import { SEASONS } from "../energy/benchmarks/types.js";
import { readingsNote } from "../energy/readings.js";
import { MAX_PROFILE_CHARS } from "../energy/readings/profile.js";
import { BENCHMARK_DATASET_ID, ENERGY_DATASET_ID, getEnergy, withStore } from "../energy/index.js";
import {
  BENCHMARK_OMISSIONS, ASSUMPTIONS, BUSINESS_ASSUMPTIONS, OMISSIONS, READINGS_ASSUMPTIONS, READINGS_OMISSIONS, UNVERIFIED_READINGS,
  rank, renderCompare, typicalCaption, typicalNotice, type CompareData,
} from "../energy/compare/rank.js";
import { resolveUsage, toCalcUsage } from "../energy/compare/resolve-usage.js";
import { resolveHours, selectPlans } from "../energy/compare/select-plans.js";
import {
  asOfFor, badPostcode, checkPostcode, dollars, inkview, inkviewResult, inkviewSource, NOTICE, source, tableMeta,
} from "./energy-common.js";

// Re-exported: other modules and tests import these from here.
export { ASSUMPTIONS, OMISSIONS, BUSINESS_ASSUMPTIONS, READINGS_OMISSIONS, UNVERIFIED_READINGS, READINGS_ASSUMPTIONS, BENCHMARK_OMISSIONS, typicalCaption, typicalNotice };
export type { BenchmarkUsage, CompareData, IfConditionsMet } from "../energy/compare/rank.js";

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
  meta: tableMeta("listings"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const customerType = args.customerType ?? "RESIDENTIAL";
    const elec = args.fuelType === "ELECTRICITY";
    const resolved = resolveUsage(args, { postcode, customerType });
    if (!resolved.ok) return resolved.result;
    const { profile, readingsVerified, ignored, scaledFromBill, shares, unit } = resolved.usage;

    return withStore<CompareData>(async (store) => {
      // Typical usage: look the AER benchmark up first, so a postcode outside it makes no estimate.
      let figure: BenchmarkFigure | undefined;
      if (resolved.usage.useBenchmark) {
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
      const usage = toCalcUsage(resolved.usage, args, figure);
      const annual = usage.annualUsage;

      let hoursBasis: CompareData["hoursBasis"];
      if (shares && !profile && !figure) {
        const h = await resolveHours(store, args);
        if (!h.ok) return h.result;
        hoursBasis = h.hoursBasis;
      }

      const sel = await selectPlans(store, args, { postcode, customerType });
      if (!sel.ok) return sel.result;
      const { plans, nets, distributor, matchedRetailer, unknownPlanIds } = sel.selection;

      const { allOk, approxAll, no, byReason, shown, approximateHours, ifConditionsMet } = rank(plans, usage, { fuelType: args.fuelType, postcode, hoursBasis, limit: args.limit ?? 10 });
      const first = shown[0];
      const typicalUsageNotice = figure ? typicalNotice(figure) : undefined;
      const readingsNotice = profile
        ? `Usage is from the household's own interval readings, ${profile.from} to ${profile.to}: ${profile.daysPresent} days present${profile.missingCount ? `, ${profile.missingCount} missing` : ""}, scaled to a year (${Math.round(annual)} kWh). Time-of-use plans are matched to the half-hourly readings. ${profile.daysPresent + profile.missingCount < 90 ? `The readings cover only ${profile.daysPresent + profile.missingCount} days, so this is a rough scale-up: say so, and if the user's file is longer, ask for a comparison from the whole file. ` : ""}This rests on one past year of use, which may not repeat.${readingsVerified ? "" : ` ${UNVERIFIED_READINGS}`}`
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
          annualUsage: Math.round(annual),
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
  render: renderCompare,
  decorate: (result) =>
    inkviewResult(
      result,
      () => {
        const r = result as Found<CompareData>;
        const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
        const d = r.data;
        // One card per plan, in the ranking order. Dollar figures are the estimate's own; the link is the labelled plan page.
        return inkview.listings({
          title: clip(`Estimated yearly cost${d.usage.basis === "benchmark" ? " at typical usage" : ""}, ${d.fuelType.toLowerCase()}, postcode ${d.postcode}`, 120),
          kind: "service",
          caption: d.usage.benchmark ? `${typicalCaption(d.usage.benchmark.householdSize, d.usage.benchmark.fiveOrMore)} ${NOTICE}` : NOTICE,
          listings: d.estimates.map((e) => ({
            id: e.planId.slice(0, 60),
            title: clip(e.displayName, 160),
            badges: [`#${e.rank}`, clip(e.brandName, 24)],
            price: { amount: e.totalCents / 100, currency: "AUD", unit: "total" },
            priceNote: "estimated yearly cost",
            detail: clip(
              `Supply ${dollars(e.breakdown.supplyCents)}, usage ${dollars(e.breakdown.usageCents)}.${e.conditionalDiscounts.length ? ` ${dollars(e.totalIfConditionsMetCents)} if you meet: ${e.conditionalDiscounts.map((c) => c.name).join("; ")}.` : ""} Plan id ${e.planId}.`,
              300,
            ),
            ...(e.link.url ? { url: e.link.url } : {}),
          })),
          source: inkviewSource(r),
        } as never);
      },
      { rowsKey: "estimates" },
    ),
});
