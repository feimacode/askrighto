import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import { linkCell, linkNotes, planLink, type PlanLink } from "../energy/links.js";
import { contractView, type ContractView } from "../energy/plan-view.js";
import type { EnergyPlan } from "../energy/types.js";
import { asOfFor, checkPostcode, badPostcode, inkview, inkviewResult, inkviewSource, NOTICE, source, tableMeta } from "./energy-common.js";

const input = z.object({
  postcode: z.string().describe("Four-digit Australian postcode of the property, e.g. 3000"),
  planIds: z.array(z.string().min(1)).min(2).max(5).describe("2 to 5 plan ids to line up, from search_energy_plans, list_current_plan_options or a compare result. They must be for the same fuel, customer type and distributor"),
  currentPlanId: z.string().optional().describe("The plan the user is on now, if it is one of planIds: its column is labelled as theirs. Nothing is marked better or worse"),
});

export const RATES_CLOSING = "These are published rates only, with no usage behind them. For a yearly cost, give usage from a bill or readings and use compare_energy_plans.";
const NOT_OFFERED = "not offered";
const BAND_LIMIT = 4;

export interface RatesPlan {
  planId: string;
  retailer: string;
  planName: string;
  planType: string;
  fuelType: string;
  customerType: "RESIDENTIAL" | "BUSINESS";
  isCurrent: boolean;
  planUrl?: string;
  link: PlanLink;
  sourceLastUpdated: string;
  /** Only the fuels all the plans share. */
  contracts: ContractView[];
}

export interface RatesData {
  postcode: string;
  customerType: "RESIDENTIAL" | "BUSINESS";
  /** Fuels every plan offers (dual fuel plans count for both). */
  fuels: Array<"ELECTRICITY" | "GAS">;
  /** Distributors every plan is on. */
  distributors: string[];
  currentPlanId?: string;
  plans: RatesPlan[];
  /** One entry per row, in order: the label and each plan's cell. */
  rows: Array<{ fuel: "ELECTRICITY" | "GAS"; label: string; cells: string[] }>;
  pricesShown: boolean;
  priceNote: string;
  closing: string;
  notice: string;
}

const none = (xs: string[]) => (xs.length ? xs : [NOT_OFFERED]);
const fuelName = (f: string) => (f === "ELECTRICITY" ? "Electricity" : "Gas");

/** The comparison rows for one fuel: the same for every plan, with "not offered" where a plan has nothing. */
function rowsFor(fuel: "ELECTRICITY" | "GAS", plans: RatesPlan[]): RatesData["rows"] {
  const cv = (p: RatesPlan) => p.contracts.find((c) => c.fuel === fuel)!;
  const cells = (pick: (c: ContractView) => string[], listAll = false) =>
    plans.map((p) => {
      const xs = none(pick(cv(p)));
      return !listAll && xs.length > BAND_LIMIT ? `${xs.length} entries, listed below the table` : xs.join("; ");
    });
  const multi = (c: ContractView) => c.periods.length > 1;
  return [
    { label: "Daily supply charge", pick: (c: ContractView) => c.periods.filter((t) => t.dailySupply).map((t) => (multi(c) ? `${t.name}: ${t.dailySupply}` : t.dailySupply!)) },
    { label: "Usage rates and hours", pick: (c: ContractView) => c.periods.flatMap((t) => (multi(c) ? t.usage.map((u) => `${t.name}: ${u}`) : t.usage)) },
    { label: "Controlled load", pick: (c: ContractView) => c.controlledLoads },
    { label: "Solar feed-in", pick: (c: ContractView) => c.solarFeedIn },
    { label: "Discounts", pick: (c: ContractView) => c.discounts.map((d) => `${d.name}${d.amount ? ` ${d.amount}` : ""} (${d.conditional ? `conditions apply: ${d.condition}` : "no conditions"})`) },
    { label: "Fees", pick: (c: ContractView) => c.fees },
    { label: "Contract length", pick: (c: ContractView) => c.terms.filter((t) => t.startsWith("term: ")).map((t) => t.slice(6)) },
    { label: "Eligibility", pick: (c: ContractView) => c.eligibility },
  ].map((r) => ({ fuel, label: r.label, cells: cells(r.pick) }));
}

export const compareEnergyPlanRates = defineTool({
  name: "compare_energy_plan_rates",
  title: "Compare energy plan rates side by side",
  description:
    "Lines up the published rates of 2 to 5 named energy plans side by side, with no usage: daily supply charge, usage rates and each band's hours, controlled load, solar feed-in, discounts with their conditions, fees, contract length and eligibility, each with its plan link and source date. Use it when the user names plans to compare and has no bill or readings (including a small business with neither). Gives no yearly cost, total or ranking and marks no plan better or worse; for a cost, use compare_energy_plans with usage. The plans must share a fuel, a customer type and a distributor. Not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("comparison"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const ids = args.planIds;
    if (new Set(ids).size !== ids.length) return notFound("needs_input", "The plan ids must all be different. Give 2 to 5 different plan ids.");
    if (args.currentPlanId && !ids.includes(args.currentPlanId)) return notFound("needs_input", `currentPlanId ${args.currentPlanId} is not one of planIds. Leave it out, or add it to planIds.`);
    return withStore<RatesData>(async (store) => {
      const got = await Promise.all(ids.map((id) => store.plan(id)));
      const missing = ids.filter((_, i) => !got[i]);
      if (missing.length) return notFound("not_in_dataset", `No current plan has the id ${missing.map((m) => `"${m}"`).join(", ")}. Search by postcode with search_energy_plans to find valid plan ids.`, { unknownPlanIds: missing });
      const plans = got as EnergyPlan[];
      const types = [...new Set(plans.map((p) => p.customerType))];
      if (types.length > 1) return notFound("needs_input", "These plans are for both homes and businesses, which are compared separately. Pick plans of one kind.");
      const customerType = types[0]!;
      const fuels = (["ELECTRICITY", "GAS"] as const).filter((f) => plans.every((p) => (f === "ELECTRICITY" ? p.electricity : p.gas)));
      if (!fuels.length) return notFound("needs_input", `These plans do not share a fuel (${plans.map((p) => `${p.displayName}: ${p.fuelType.toLowerCase()}`).join("; ")}). Pick plans for one fuel, or dual fuel plans.`);
      // Rates differ by network, so plans on different distributors are not lined up.
      const lists = plans.map((p) => p.geography.distributors);
      const common = lists[0]!.filter((d) => lists.every((l) => l.some((x) => x.toLowerCase() === d.toLowerCase())));
      if (!common.length) {
        return notFound("needs_input", `These plans are on different distributors (${plans.map((p) => `${p.displayName}: ${p.geography.distributors.join(", ") || "not stated"}`).join("; ")}), and rates differ by network. Ask the user which distributor is on their bill, then pick plans on that one.`, { distributors: [...new Set(lists.flat())] });
      }
      const here = new Set((await store.plans({ postcode, customerType })).map((p) => p.planId));
      const away = plans.filter((p) => !here.has(p.planId));
      if (away.length) return notFound("not_in_dataset", `${away.map((p) => `${p.displayName} (${p.planId})`).join(", ")} ${away.length === 1 ? "is" : "are"} not offered at postcode ${postcode}. Search with search_energy_plans for this postcode.`, { unknownPlanIds: away.map((p) => p.planId) });

      const unknown = plans.some((p) => [p.electricity, p.gas].some((c) => c?.gstBasis === "UNKNOWN"));
      const out: RatesPlan[] = plans.map((p) => ({
        planId: p.planId,
        retailer: p.brandName,
        planName: p.displayName,
        planType: p.planType,
        fuelType: p.fuelType,
        customerType: p.customerType,
        isCurrent: p.planId === args.currentPlanId,
        ...(p.planUrl ? { planUrl: p.planUrl } : {}),
        link: planLink(p, postcode),
        sourceLastUpdated: p.sourceLastUpdated,
        contracts: fuels.map((f) => contractView(f, (f === "ELECTRICITY" ? p.electricity : p.gas)!)),
      }));
      const data: RatesData = {
        postcode,
        customerType,
        fuels: [...fuels],
        distributors: common,
        ...(args.currentPlanId ? { currentPlanId: args.currentPlanId } : {}),
        plans: out,
        rows: fuels.flatMap((f) => rowsFor(f, out)),
        pricesShown: !unknown,
        priceNote: unknown ? "Dollar amounts are withheld because whether the published amounts include GST has not been confirmed. Use the plan links for prices." : "Usage and supply rates include GST, as on an invoice; feed-in credits and fees are as published.",
        closing: RATES_CLOSING,
        notice: NOTICE,
      };
      return found({ data, source, asOf: asOfFor(plans) });
    });
  },
  render: (d) => {
    const head = (p: RatesPlan) => `${p.retailer} ${p.planName}${p.isCurrent ? " (your current plan)" : ""}`.replace(/\|/g, "/");
    const out = [
      `Published rates of ${d.plans.length} ${d.customerType.toLowerCase()} ${d.fuels.map((f) => f.toLowerCase()).join(" and ")} plans on ${d.distributors.join(", ")} at postcode ${d.postcode}, in the order given. ${d.priceNote} Nothing here is ordered by price or judged.`,
      "",
    ];
    const multi = d.fuels.length > 1;
    for (const f of d.fuels) {
      if (multi) out.push(`**${fuelName(f)}**`, "");
      out.push(`| | ${d.plans.map(head).join(" | ")} |`, `| --- |${d.plans.map(() => " --- |").join("")}`);
      const rows = d.rows.filter((r) => r.fuel === f);
      for (const r of rows) out.push(`| ${r.label} | ${r.cells.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`);
      out.push("");
      // Long rows (many bands or fees) are listed in full below the table.
      d.plans.forEach((p, i) => {
        const c = p.contracts.find((x) => x.fuel === f)!;
        const long: Array<[string, string[]]> = [
          ["Usage rates and hours", c.periods.flatMap((t) => (c.periods.length > 1 ? t.usage.map((u) => `${t.name}: ${u}`) : t.usage))],
          ["Discounts", c.discounts.map((x) => `${x.name}${x.amount ? ` ${x.amount}` : ""} (${x.conditional ? `conditions apply: ${x.condition}` : "no conditions"})`)],
          ["Fees", c.fees],
          ["Eligibility", c.eligibility],
        ];
        for (const [label, xs] of long) if (xs.length > BAND_LIMIT) out.push(`${head(d.plans[i]!)}, ${label.toLowerCase()}:`, ...xs.map((x) => `- ${x}`), "");
      });
    }
    out.push("Plan links:");
    for (const p of d.plans) out.push(`- ${head(p)} (id ${p.planId}, source updated ${p.sourceLastUpdated.slice(0, 10)}): ${linkCell(p.link)}`);
    out.push("", ...linkNotes(d.plans.map((p) => p.link)), "", d.closing, "", d.notice);
    return out.join("\n");
  },
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<RatesData>;
      const d = r.data;
      const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
      const multi = d.fuels.length > 1;
      return inkview.comparison({
        title: clip(`Published rates, postcode ${d.postcode} (no cost, no ranking)`, 120),
        items: d.plans.map((p) => ({
          name: clip(`${p.planName}${p.isCurrent ? " (your current plan)" : ""}`, 80),
          subtitle: clip(p.retailer, 120),
          ...(p.link.url ? { url: p.link.url } : {}),
        })),
        criteria: d.rows.map((r) => clip(multi ? `${fuelName(r.fuel)}: ${r.label}` : r.label, 80)),
        values: d.plans.map((_, pi) => d.rows.map((r) => clip(r.cells[pi]!, 200))),
        source: inkviewSource(r),
      } as never);
    }),
});
