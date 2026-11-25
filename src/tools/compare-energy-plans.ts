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
  rank, renderCompare, signed, usageAccuracy, typicalCaption, typicalNotice, type CompareData,
} from "../energy/compare/rank.js";
import { resolveUsage, toCalcUsage, USAGE_SOURCES } from "../energy/compare/resolve-usage.js";
import { CURRENT_PLAN_NOTE, resolveCurrent } from "../energy/compare/current.js";
import { resolveHours, selectPlans } from "../energy/compare/select-plans.js";
import {
  asOfFor, badPostcode, checkPostcode, dollars, inkview, inkviewResult, inkviewSource, NOTICE, source, tableMeta,
} from "./energy-common.js";

// Re-exported: other modules and tests import these from here.
export { ASSUMPTIONS, OMISSIONS, BUSINESS_ASSUMPTIONS, READINGS_OMISSIONS, UNVERIFIED_READINGS, READINGS_ASSUMPTIONS, BENCHMARK_OMISSIONS, typicalCaption, typicalNotice };
export type { BenchmarkUsage, CompareData, IfConditionsMet } from "../energy/compare/rank.js";

const input = z.object({
  postcode: z.string().describe("Four-digit Australian postcode of the property, e.g. 3000"),
  customerType: z.enum(["RESIDENTIAL", "BUSINESS"]).describe("Whose plans: RESIDENTIAL (a home) or BUSINESS (small business; large customers are not compared). Required: ask the user which, never assume. A business is only compared with business plans and a household with residential plans"),
  fuelType: z.enum(["ELECTRICITY", "GAS"]).describe("Which fuel to compare"),
  usageSource: z.enum(USAGE_SOURCES).describe("What the usage rests on, best first: readings (a profile from summarise_interval_readings), assistant_readings (readings you summed yourself because the file was too big to send; needs usage, usageDays, the split and the hours), bill (one bill's usage and its days), yearly (a year's usage), typical (no usage: the AER benchmark for householdSize, only if the user has no bill and agrees). Each field below says which sources use it; a field from another source is refused"),
  usage: z.number().positive().max(10_000_000).optional().describe("bill, assistant_readings, yearly: energy used, in kWh for electricity and MJ for gas. For bill and assistant_readings it covers usageDays; for yearly it is a year"),
  usageDays: z.number().int().min(1).max(400).optional().describe("bill, assistant_readings: number of days that usage covers. Not used with yearly"),
  peakSharePct: z.number().min(0).max(100).optional().describe("bill, yearly, assistant_readings (electricity): percent used at peak times, from the bill. Needed for time-of-use plans"),
  shoulderSharePct: z.number().min(0).max(100).optional().describe("bill, yearly, assistant_readings (electricity): percent used at shoulder times (0 if none)"),
  offPeakSharePct: z.number().min(0).max(100).optional().describe("bill, yearly, assistant_readings (electricity): percent used at off-peak times"),
  householdSize: z.number().int().min(1).max(5).optional().describe("typical only: number of people in the household, 1 to 5 (5 means five or more)"),
  readingsProfile: z.string().max(MAX_PROFILE_CHARS).optional().describe("readings only (electricity): the profile string returned by summarise_interval_readings, passed unchanged. Uses the household's own half-hourly readings, which also lets time-of-use plans be estimated"),
  currentPlanId: z.string().max(80).optional().describe("assistant_readings (required, or hoursLayoutId), bill, yearly (with a split): the plan id the household is on now, taken from the option the user picked in list_current_plan_options. With a split, only plans with the same band hours as this plan are estimated exactly; other time-of-use plans are labelled approximate and listed apart"),
  hoursLayoutId: z.string().max(16).optional().describe("Used like currentPlanId, when the user's plan was not listed: the band-hours layout id the user picked in list_current_plan_options. Give one or the other, not both"),
  controlledLoadAnnualKwh: z.number().min(0).max(1_000_000).optional().describe("readings, bill, yearly, assistant_readings (electricity): yearly controlled load kWh (for example a hot water system), if the household has one"),
  solarExportAnnualKwh: z.number().min(0).max(1_000_000).optional().describe("bill, yearly, assistant_readings (electricity): yearly kWh exported to the grid by solar panels, if any. With readings the profile carries the export, so do not send it"),
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
    "Estimates the yearly cost of the current energy plans at a postcode, ordered from the lowest estimate to the highest, with a cost breakdown, conditional discounts and the plans that cannot be estimated. Always set usageSource to say what the usage rests on: readings (call summarise_interval_readings first and pass its profile as readingsProfile; time-of-use plans are matched to the half-hourly readings), assistant_readings (readings you summed yourself because the file was too big to send: usage, usageDays, the peak, shoulder and off-peak split, and currentPlanId or hoursLayoutId), bill (usage and usageDays from a recent bill, with the split for time-of-use plans), yearly (usage for a year) or typical (only if the user has no bill and agrees: householdSize, and the AER's typical household use is used; the result is labelled typical usage, not theirs, and time-of-use plans are not estimated). A field that does not belong to the usageSource is refused, not ignored. With currentPlanId (the plan the user picked in list_current_plan_options) it also costs the current plan on the same usage as a baseline, shown on its own line and not ranked, and each plan shows its difference from it (a lower or higher estimate for the usage given); never say better, save, switch or recommended. The result states the usage level and how far to trust it. Estimates only, not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("listings"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const customerType = args.customerType;
    const elec = args.fuelType === "ELECTRICITY";
    const resolved = resolveUsage(args, { postcode, customerType });
    if (!resolved.ok) return resolved.result;
    const { level, profile, readingsVerified, scaledFromBill, shares, unit, days, warnings: usageWarnings } = resolved.usage;

    return withStore<CompareData>(async (store) => {
      // Typical usage: look the AER benchmark up first, so a postcode outside it makes no estimate.
      let figure: BenchmarkFigure | undefined;
      if (level === "typical") {
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
      const { nets, distributor, matchedRetailer, unknownPlanIds } = sel.selection;

      // The current plan is costed on the same usage as a baseline and is never a candidate.
      const { current, estimate: currentEstimate } = await resolveCurrent(store, args, { postcode, customerType, distributor, usage });
      const plans = sel.selection.plans.filter((p) => p.planId !== args.currentPlanId);

      const { allOk, approxAll, no, byReason, shown, approximateHours, ifConditionsMet, lowerThanCurrent } = rank(plans, usage, { fuelType: args.fuelType, postcode, hoursBasis, limit: args.limit ?? 10, current: currentEstimate });
      const first = shown[0];
      const typicalUsageNotice = figure ? typicalNotice(figure) : undefined;
      const readingsNotice = profile
        ? `Usage is from the household's own interval readings, ${profile.from} to ${profile.to}: ${profile.daysPresent} days present${profile.missingCount ? `, ${profile.missingCount} missing` : ""}, scaled to a year (${Math.round(annual)} kWh). Time-of-use plans are matched to the half-hourly readings. ${profile.daysPresent + profile.missingCount < 90 ? `The readings cover only ${profile.daysPresent + profile.missingCount} days, so this is a rough scale-up: say so, and if the user's file is longer, ask for a comparison from the whole file. ` : ""}This rests on one past year of use, which may not repeat.${readingsVerified ? "" : ` ${UNVERIFIED_READINGS}`}`
        : undefined;
      // Interval readings would be more accurate than a benchmark or one bill (electricity only; gas has no interval data here).
      const note = elec && (figure || (level === "bill" && scaledFromBill)) ? readingsNote(distributor ?? (nets.length === 1 ? nets[0] : undefined)) : undefined;
      const baselineLine = lowerThanCurrent === undefined ? "" : lowerThanCurrent === 0 ? " No plan in the main table has a lower estimate than your current plan for the usage given." : ` ${lowerThanCurrent} plan${lowerThanCurrent === 1 ? " has" : "s have"} a lower estimate than your current plan for the usage given.`;
      const summary0 = first
        ? `Of ${plans.length} plan${plans.length === 1 ? "" : "s"} available, ${allOk.length} could be estimated${approxAll.length ? ` (${approxAll.length} only approximately, listed apart)` : ""} and ${no.length} could not. The lowest estimate for ${figure ? "typical usage (not the household's own)" : profile ? "the household's own readings" : "the usage given"} is ${dollars(first.totalCents)} a year (${first.brandName}, ${first.displayName}); this ordering is by estimated cost only.`
        : approxAll.length
          ? `Of ${plans.length} plans available, ${approxAll.length} time-of-use plans could be estimated only approximately because the household's own hours ${hoursBasis?.known ? "differ from theirs" : "are not known"}; none matched exactly.`
          : `Of ${plans.length} plan${plans.length === 1 ? "" : "s"} available, none could be estimated with the information given.`;
      const summary = `${summary0}${baselineLine}`;
      const data: CompareData = {
        postcode,
        customerType,
        fuelType: args.fuelType,
        ...(distributor ? { distributor } : {}),
        ...(matchedRetailer ? { matchedRetailer } : {}),
        usage: {
          level,
          accuracy: usageAccuracy({ level, unit, annual, days, hasSplit: !!shares, hoursFrom: hoursBasis?.from, profile, verified: readingsVerified, typicalNotice: typicalUsageNotice }),
          annualUsage: Math.round(annual),
          unit,
          basis: usage.basis ?? "customer",
          ...(scaledFromBill ? { scaledFromBill } : {}),
          ...(profile ? { readings: { verified: readingsVerified, from: profile.from, to: profile.to, daysPresent: profile.daysPresent, missingCount: profile.missingCount, missingDates: profile.missing, streams: profile.streams, netOnly: profile.netOnly } } : {}),
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
        warnings: usageWarnings,
        current,
        counts: { available: plans.length, estimated: allOk.length, notEstimated: no.length, returned: shown.length, approximate: approxAll.length, current: current.costed ? 1 : 0, ...(lowerThanCurrent !== undefined ? { lowerThanCurrent } : {}) },
        approximateHours,
        ...(hoursBasis ? { hoursBasis } : {}),
        summary,
        estimates: shown,
        ifConditionsMet,
        notEstimated: no.slice(0, 50),
        notEstimatedByReason: byReason,
        ...(unknownPlanIds?.length ? { unknownPlanIds } : {}),
        assumptions: [...(profile ? [...ASSUMPTIONS, ...READINGS_ASSUMPTIONS] : ASSUMPTIONS), ...(current.costed ? [CURRENT_PLAN_NOTE] : []), ...(customerType === "BUSINESS" ? BUSINESS_ASSUMPTIONS : [])],
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
              `${e.differenceFromCurrentCents !== undefined ? `${signed(e.differenceFromCurrentCents)} vs current plan. ` : ""}Supply ${dollars(e.breakdown.supplyCents)}, usage ${dollars(e.breakdown.usageCents)}.${e.conditionalDiscounts.length ? ` ${dollars(e.totalIfConditionsMetCents)} if you meet: ${e.conditionalDiscounts.map((c) => c.name).join("; ")}.` : ""} Plan id ${e.planId}.`,
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
