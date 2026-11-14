import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { estimateAnnualCost, type Estimate, type NotEstimated, type Usage } from "../energy/calc.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import {
  asOfFor, badPostcode, checkPostcode, COVERAGE_STATES, dollars, inkview, inkviewResult, inkviewSource, matchRetailer, NOTICE, source, tableMeta,
} from "./energy-common.js";

const input = z.object({
  postcode: z.string().describe("Four-digit Australian postcode of the property, e.g. 3000"),
  fuelType: z.enum(["ELECTRICITY", "GAS"]).describe("Which fuel to compare"),
  annualUsageKwh: z.number().positive().max(1_000_000).optional().describe("Electricity used in a year, in kWh"),
  billUsageKwh: z.number().positive().max(1_000_000).optional().describe("Electricity used in one bill period, in kWh. Give billDays too"),
  annualUsageMj: z.number().positive().max(10_000_000).optional().describe("Gas used in a year, in MJ"),
  billUsageMj: z.number().positive().max(10_000_000).optional().describe("Gas used in one bill period, in MJ. Give billDays too"),
  billDays: z.number().int().min(1).max(400).optional().describe("Number of days the bill covers"),
  peakSharePct: z.number().min(0).max(100).optional().describe("Percent of electricity used at peak times, from the bill. Needed for time-of-use plans"),
  shoulderSharePct: z.number().min(0).max(100).optional().describe("Percent used at shoulder times (0 if none)"),
  offPeakSharePct: z.number().min(0).max(100).optional().describe("Percent used at off-peak times"),
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
  "Amounts include GST (10%) where the published rates exclude it. Solar feed-in credits are shown without GST.",
  "Conditional discounts (such as pay on time) are not in the ordering cost; each is listed with its condition and the lower cost if it is met.",
];
export const OMISSIONS = [
  "One-off fees (exit, connection, late payment and similar), sign-up credits, concessions and rebates, and green power charges are left out.",
  "Eligibility restrictions are shown beside a plan but not checked against the household.",
];

export interface CompareData {
  postcode: string;
  fuelType: string;
  distributor?: string;
  matchedRetailer?: string;
  usage: { annualUsage: number; unit: "kWh" | "MJ"; scaledFromBill?: string; shares?: Usage["shares"]; controlledLoadAnnualKwh?: number; solarExportAnnualKwh?: number };
  counts: { available: number; estimated: number; notEstimated: number; returned: number };
  summary: string;
  estimates: Array<Estimate & { rank: number }>;
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
    "Estimates the yearly cost of the current energy plans at a postcode for the usage the user gives (kWh or MJ from a recent bill), ordered from the lowest estimate to the highest, with a cost breakdown, conditional discounts and the plans that cannot be estimated. Needs usage figures; time-of-use plans also need the peak, shoulder and off-peak split from the bill. Estimates only, not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("data_table"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const elec = args.fuelType === "ELECTRICITY";
    const annualDirect = elec ? args.annualUsageKwh : args.annualUsageMj;
    const bill = elec ? args.billUsageKwh : args.billUsageMj;
    const unit = elec ? "kWh" : "MJ";
    let annual = annualDirect;
    let scaledFromBill: string | undefined;
    if (annual === undefined && bill !== undefined) {
      if (!args.billDays) return notFound("needs_input", `A bill's ${unit} figure needs the number of days the bill covers. Ask the user for billDays.`);
      annual = (bill * 365) / args.billDays;
      scaledFromBill = `${bill} ${unit} over ${args.billDays} days scaled to a year (x 365/${args.billDays}); real use varies with the seasons`;
    }
    if (annual === undefined) {
      return notFound("needs_input", `No usage was given. Ask the user for the ${unit} used and the number of days from a recent bill (or their yearly ${unit}), then call again.`);
    }
    let shares: Usage["shares"];
    if (args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined) {
      if (!elec) return notFound("needs_input", "Peak and off-peak shares apply to electricity only.");
      shares = { peak: args.peakSharePct ?? 0, shoulder: args.shoulderSharePct ?? 0, offPeak: args.offPeakSharePct ?? 0 };
      const sum = shares.peak + shares.shoulder + shares.offPeak;
      if (Math.abs(sum - 100) > 0.5) return notFound("needs_input", `The peak, shoulder and off-peak shares add up to ${sum}%, not 100%. Ask the user to check the split on their bill.`);
    }
    const usage: Usage = {
      fuel: args.fuelType,
      annualUsage: annual,
      ...(shares ? { shares } : {}),
      ...(elec && args.controlledLoadAnnualKwh ? { controlledLoadAnnualKwh: args.controlledLoadAnnualKwh } : {}),
      ...(elec && args.solarExportAnnualKwh ? { solarExportAnnualKwh: args.solarExportAnnualKwh } : {}),
    };

    return withStore<CompareData>(async (store) => {
      let plans = (await store.plans({ postcode })).filter((p) => p.fuelType === args.fuelType || p.fuelType === "DUAL");
      if (plans.length === 0) return notFound("outside_coverage", `No ${args.fuelType.toLowerCase()} plans are stored for postcode ${postcode}. The data covers ${COVERAGE_STATES}.`, { states: COVERAGE_STATES });

      // Network tariffs differ, so a mixed-network ranking would mislead. Distributors come from single-fuel plans.
      const nets = [...new Set(plans.filter((p) => p.fuelType === args.fuelType).flatMap((p) => p.geography.distributors))].sort();
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
        plans = plans.filter((p) => p.retailerSlug === m.slug);
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
      const ok = results.filter((r): r is Estimate => r.estimated).sort((a, b) => a.totalCents - b.totalCents || a.brandName.localeCompare(b.brandName) || a.planId.localeCompare(b.planId));
      const no = results.filter((r): r is NotEstimated => !r.estimated).sort((a, b) => a.reason.localeCompare(b.reason) || a.brandName.localeCompare(b.brandName) || a.planId.localeCompare(b.planId));
      const byReason: Record<string, number> = {};
      for (const n of no) byReason[n.reason] = (byReason[n.reason] ?? 0) + 1;
      const limit = args.limit ?? 10;
      const shown = ok.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
      const first = shown[0];
      const summary = first
        ? `Of ${plans.length} plan${plans.length === 1 ? "" : "s"} available, ${ok.length} could be estimated and ${no.length} could not. The lowest estimate for the usage given is ${dollars(first.totalCents)} a year (${first.brandName}, ${first.displayName}); this ordering is by estimated cost only.`
        : `Of ${plans.length} plan${plans.length === 1 ? "" : "s"} available, none could be estimated with the information given.`;
      const data: CompareData = {
        postcode,
        fuelType: args.fuelType,
        ...(distributor ? { distributor } : {}),
        ...(matchedRetailer ? { matchedRetailer } : {}),
        usage: {
          annualUsage: Math.round(annual),
          unit,
          ...(scaledFromBill ? { scaledFromBill } : {}),
          ...(shares ? { shares } : {}),
          ...(usage.controlledLoadAnnualKwh ? { controlledLoadAnnualKwh: usage.controlledLoadAnnualKwh } : {}),
          ...(usage.solarExportAnnualKwh ? { solarExportAnnualKwh: usage.solarExportAnnualKwh } : {}),
        },
        counts: { available: plans.length, estimated: ok.length, notEstimated: no.length, returned: shown.length },
        summary,
        estimates: shown,
        notEstimated: no.slice(0, 50),
        notEstimatedByReason: byReason,
        ...(unknownPlanIds?.length ? { unknownPlanIds } : {}),
        assumptions: ASSUMPTIONS,
        omissions: OMISSIONS,
        notice: NOTICE,
      };
      return found({ data, source, asOf: asOfFor(plans) });
    });
  },
  render: (d) => {
    const u = d.usage;
    const out = [
      d.summary,
      "",
      `Usage assumed: ${u.annualUsage} ${u.unit} a year${u.scaledFromBill ? ` (${u.scaledFromBill})` : ""}${u.shares ? `; peak ${u.shares.peak}%, shoulder ${u.shares.shoulder}%, off-peak ${u.shares.offPeak}%` : ""}${u.controlledLoadAnnualKwh ? `; controlled load ${u.controlledLoadAnnualKwh} kWh` : ""}${u.solarExportAnnualKwh ? `; solar export ${u.solarExportAnnualKwh} kWh` : ""}${d.distributor ? `; distributor ${d.distributor}` : ""}.`,
      "",
    ];
    if (d.estimates.length) {
      out.push(
        "| # | Retailer | Plan | Est. yearly cost | Supply | Usage | Controlled load | Solar credit | Cost if conditions met | Updated | Plan |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ...d.estimates.map(
          (e) =>
            `| ${e.rank} | ${e.brandName} | ${e.displayName} | ${dollars(e.totalCents)} | ${dollars(e.breakdown.supplyCents)} | ${dollars(e.breakdown.usageCents)} | ${dollars(e.breakdown.controlledLoadCents)} | ${dollars(e.breakdown.feedInCreditCents)} | ${e.conditionalDiscounts.length ? dollars(e.totalIfConditionsMetCents) : "-"} | ${e.sourceLastUpdated.slice(0, 10)} | ${e.planUrl ?? e.planId} |`,
        ),
        "",
        "Breakdown per plan also includes guaranteed discounts, recurring fees and GST; each plan's components add up to its total.",
      );
      for (const e of d.estimates) {
        const extra = [
          ...e.conditionalDiscounts.map((c) => `conditional discount ${c.name}: ${c.condition}${c.savingCents !== undefined ? ` (saves about ${dollars(c.savingCents)})` : ""}`),
          ...e.restrictions.map((r) => `restriction: ${r}`),
          ...e.notes,
          ...e.notIncluded.map((n) => `not included: ${n}`),
        ];
        if (extra.length) out.push(`- #${e.rank} ${e.brandName} ${e.displayName}: ${extra.join("; ")}`);
      }
    }
    if (d.counts.notEstimated) {
      out.push("", `Not estimated (${d.counts.notEstimated}): ${Object.entries(d.notEstimatedByReason).map(([r, n]) => `${n} ${r}`).join(", ")}.`);
      for (const n of d.notEstimated.slice(0, 15)) out.push(`- ${n.brandName} ${n.displayName} (${n.planId}): ${n.reason}. ${n.detail}`);
      if (d.notEstimated.length > 15) out.push(`- and ${d.counts.notEstimated - 15} more (see structured data).`);
    }
    if (d.unknownPlanIds?.length) out.push("", `Plan ids not found among the available plans: ${d.unknownPlanIds.join(", ")}.`);
    out.push("", "Assumptions:", ...d.assumptions.map((a) => `- ${a}`), "Left out:", ...d.omissions.map((a) => `- ${a}`), "", NOTICE);
    return out.join("\n");
  },
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CompareData>;
      return inkview.table(
        {
          title: `Estimated yearly cost, ${r.data.fuelType.toLowerCase()}, postcode ${r.data.postcode}`,
          caption: NOTICE,
          columns: [
            { key: "rank", label: "#", type: "number" },
            { key: "retailer", label: "Retailer" },
            { key: "plan", label: "Plan" },
            { key: "total", label: "Est. yearly cost", type: "money", currency: "AUD" },
            { key: "supply", label: "Supply", type: "money", currency: "AUD" },
            { key: "usage", label: "Usage", type: "money", currency: "AUD" },
            { key: "ifMet", label: "Cost if conditions met", type: "money", currency: "AUD" },
            { key: "updated", label: "Updated", type: "date" },
          ],
          rows: r.data.estimates.map((e) => ({
            rank: e.rank,
            retailer: e.brandName,
            plan: e.displayName,
            total: e.totalCents / 100,
            supply: e.breakdown.supplyCents / 100,
            usage: e.breakdown.usageCents / 100,
            ifMet: e.conditionalDiscounts.length ? e.totalIfConditionsMetCents / 100 : null,
            updated: e.sourceLastUpdated.slice(0, 10),
          })),
          source: inkviewSource(r),
        },
        { limit: 50 },
      );
    }),
});
