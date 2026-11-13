import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import type { EnergyPlan } from "../energy/types.js";
import { asOfFor, badPostcode, checkPostcode, COVERAGE_STATES, inkview, inkviewResult, inkviewSource, matchRetailer, NOTICE, source, tableMeta } from "./energy-common.js";

const input = z.object({
  postcode: z.string().describe("Four-digit Australian postcode of the property, e.g. 3000"),
  fuelType: z.enum(["ELECTRICITY", "GAS"]).optional().describe("Only plans that include this fuel (dual fuel plans are included)"),
  retailer: z.string().optional().describe("Retailer or brand name, e.g. Origin"),
  distributor: z.string().optional().describe("Distribution network name from the user's bill, e.g. CitiPower"),
  planType: z.enum(["MARKET", "STANDING", "REGULATED"]).optional().describe("Plan type"),
  hasSolarFeedIn: z.boolean().optional().describe("Only electricity plans that pay for solar exports"),
  hasControlledLoad: z.boolean().optional().describe("Only electricity plans with a controlled load rate"),
  limit: z.number().int().min(1).max(50).optional().describe("Plans per page, default 20, maximum 50"),
  cursor: z.string().optional().describe("The nextCursor value from the previous page"),
});

interface Row {
  planId: string;
  retailer: string;
  planName: string;
  fuelType: string;
  planType: string;
  tariffType: string;
  distributors: string[];
  sourceLastUpdated: string;
  planUrl?: string;
  understood: boolean;
}

export interface SearchData {
  postcode: string;
  total: number;
  returned: number;
  nextCursor?: string;
  matchedRetailer?: string;
  distributorsByFuel: Record<string, string[]>;
  needsDistributor: boolean;
  askUser?: string;
  plans: Row[];
  notice: string;
}

const tariff = (p: EnergyPlan) => [p.electricity?.pricingModel, p.gas?.pricingModel].filter(Boolean).join(" / ");

export const searchEnergyPlans = defineTool({
  name: "search_energy_plans",
  title: "Search energy plans",
  description:
    "Finds current residential electricity and gas plans available at an Australian postcode, from the AER's published plan data. Use it to list plans, narrow by retailer, fuel, network or features, and get plan ids for get_energy_plan or compare_energy_plans. It shows no costs; use compare_energy_plans for those.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("data_table"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    return withStore<SearchData>(async (store) => {
      const all = await store.plans({ postcode });
      if (all.length === 0) {
        return notFound("outside_coverage", `No plans are stored for postcode ${postcode}. The data covers ${COVERAGE_STATES}.`, { states: COVERAGE_STATES });
      }
      let plans = all;
      let matchedRetailer: string | undefined;
      if (args.retailer) {
        const m = matchRetailer(all, args.retailer);
        if (!m) return notFound("not_in_dataset", `No retailer matching "${args.retailer}" has plans at ${postcode}.`);
        if ("candidates" in m) {
          return notFound("needs_input", `"${args.retailer}" could match more than one retailer. Ask the user which one they mean.`, { candidates: m.candidates.map((c) => c.brandName) });
        }
        matchedRetailer = m.brandName;
        plans = plans.filter((p) => p.retailerSlug === m.slug);
      }
      if (args.fuelType) plans = plans.filter((p) => p.fuelType === args.fuelType || p.fuelType === "DUAL");
      if (args.planType) plans = plans.filter((p) => p.planType === args.planType);
      if (args.distributor) {
        const d = args.distributor.toLowerCase();
        plans = plans.filter((p) => p.geography.distributors.some((x) => x.toLowerCase() === d));
      }
      if (args.hasSolarFeedIn) plans = plans.filter((p) => (p.electricity?.solarFeedIn.length ?? 0) > 0);
      if (args.hasControlledLoad) plans = plans.filter((p) => (p.electricity?.controlledLoads.length ?? 0) > 0);
      if (plans.length === 0) return notFound("not_in_dataset", `No plans at ${postcode} match those filters.`);

      plans = [...plans].sort((a, b) => a.brandName.localeCompare(b.brandName) || a.displayName.localeCompare(b.displayName) || a.planId.localeCompare(b.planId));

      // Distributors come from single-fuel plans, since a dual fuel plan lists both fuels' networks.
      const byFuel: Record<string, string[]> = {};
      for (const fuel of ["ELECTRICITY", "GAS"] as const) {
        const set = new Set(plans.filter((p) => p.fuelType === fuel).flatMap((p) => p.geography.distributors));
        if (set.size) byFuel[fuel] = [...set].sort();
      }
      const relevant = args.fuelType ? [args.fuelType] : (["ELECTRICITY", "GAS"] as const);
      const multi = relevant.filter((f) => (byFuel[f]?.length ?? 0) > 1);
      const needsDistributor = !args.distributor && multi.length > 0;

      const limit = args.limit ?? 20;
      const start = Math.max(0, parseInt(args.cursor ?? "0", 10) || 0);
      const page = plans.slice(start, start + limit);
      const rows: Row[] = page.map((p) => ({
        planId: p.planId,
        retailer: p.brandName,
        planName: p.displayName,
        fuelType: p.fuelType,
        planType: p.planType,
        tariffType: tariff(p),
        distributors: p.geography.distributors,
        sourceLastUpdated: p.sourceLastUpdated,
        ...(p.planUrl ? { planUrl: p.planUrl } : {}),
        understood: p.understood,
      }));
      const data: SearchData = {
        postcode,
        total: plans.length,
        returned: rows.length,
        ...(start + limit < plans.length ? { nextCursor: String(start + limit) } : {}),
        ...(matchedRetailer ? { matchedRetailer } : {}),
        distributorsByFuel: byFuel,
        needsDistributor,
        ...(needsDistributor
          ? { askUser: `This postcode is served by more than one distributor (${multi.map((f) => `${f.toLowerCase()}: ${byFuel[f]!.join(", ")}`).join("; ")}). Ask the user which one is on their bill before comparing costs.` }
          : {}),
        plans: rows,
        notice: NOTICE,
      };
      return found({ data, source, asOf: asOfFor(page) });
    });
  },
  render: (d) => {
    const lines = [
      `${d.total} current residential plan${d.total === 1 ? "" : "s"} at postcode ${d.postcode}${d.matchedRetailer ? ` (retailer matched: ${d.matchedRetailer})` : ""}; showing ${d.returned}.`,
      "",
      "| Retailer | Plan | Fuel | Type | Tariff | Distributor | Updated | Plan id |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...d.plans.map(
        (p) => `| ${p.retailer} | ${p.planUrl ? `[${p.planName}](${p.planUrl})` : p.planName} | ${p.fuelType} | ${p.planType} | ${p.tariffType} | ${p.distributors.join(", ")} | ${p.sourceLastUpdated.slice(0, 10)} | ${p.planId} |`,
      ),
    ];
    if (d.askUser) lines.push("", d.askUser);
    if (d.nextCursor) lines.push("", `More plans are available: call again with cursor "${d.nextCursor}".`);
    lines.push("", NOTICE);
    return lines.join("\n");
  },
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as import("../core/grounded.js").Found<SearchData>;
      return inkview.table(
        {
          title: `Energy plans at ${r.data.postcode}`,
          caption: NOTICE,
          columns: [
            { key: "retailer", label: "Retailer" },
            { key: "planName", label: "Plan" },
            { key: "fuelType", label: "Fuel", type: "badge" },
            { key: "planType", label: "Type", type: "badge" },
            { key: "tariffType", label: "Tariff" },
            { key: "distributors", label: "Distributor" },
            { key: "updated", label: "Updated", type: "date" },
            { key: "planId", label: "Plan id" },
          ],
          rows: r.data.plans.map((p) => ({ ...p, distributors: p.distributors.join(", "), updated: p.sourceLastUpdated.slice(0, 10) })),
          source: inkviewSource(r),
        },
        { limit: 50 },
      );
    }),
});
