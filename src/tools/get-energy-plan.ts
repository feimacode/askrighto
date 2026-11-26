import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import { linkMarkdown, linkNotes, planLink, type PlanLink } from "../energy/links.js";
import { contractView as view, type ContractView } from "../energy/plan-view.js";
import { asOfFor, checkPostcode, inkview, inkviewResult, inkviewSource, NOTICE, source, tableMeta } from "./energy-common.js";

const input = z.object({
  planId: z.string().min(1).describe("Plan id from search_energy_plans"),
  postcode: z.string().optional().describe("Four-digit postcode of the property. Needed for the Energy Made Easy rate sheet link"),
});

export interface PlanData {
  planId: string;
  customerType: "RESIDENTIAL" | "BUSINESS";
  retailer: string;
  planName: string;
  fuelType: string;
  planType: string;
  distributors: string[];
  planUrl?: string;
  /** Labelled link to the rate sheet (Energy Made Easy) or the retailer's website; see links.ts. */
  link: PlanLink;
  sourceLastUpdated: string;
  pricesShown: boolean;
  priceNote: string;
  understood: boolean;
  notUnderstood: string[];
  contracts: ContractView[];
  notice: string;
}

export const getEnergyPlan = defineTool({
  name: "get_energy_plan",
  title: "Get energy plan details",
  description:
    "Shows one energy plan in full from the AER's published plan data: supply charge, usage rates and blocks, time-of-use windows, controlled load, solar feed-in, discounts with their conditions, fees, eligibility and terms, with a labelled link to the rate sheet on Energy Made Easy (give the postcode) or, for Victorian plans, to the retailer's website. Use a plan id from search_energy_plans.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("entity_card"),
  handler: (args) =>
    withStore<PlanData>(async (store) => {
      const pc = args.postcode === undefined ? undefined : checkPostcode(args.postcode);
      if (args.postcode !== undefined && !pc) return notFound("needs_input", "A postcode is four digits, for example 3000. Ask the user for the postcode of the property, or call again without it.");
      const p = await store.plan(args.planId);
      if (!p) return notFound("not_in_dataset", `No current plan has the id "${args.planId}". Search by postcode with search_energy_plans to find valid plan ids.`);
      const contracts = [p.electricity ? view("ELECTRICITY", p.electricity) : undefined, p.gas ? view("GAS", p.gas) : undefined].filter((x): x is ContractView => !!x);
      const unknown = [p.electricity, p.gas].some((c) => c?.gstBasis === "UNKNOWN");
      const data: PlanData = {
        planId: p.planId,
        customerType: p.customerType,
        retailer: p.brandName,
        planName: p.displayName,
        fuelType: p.fuelType,
        planType: p.planType,
        distributors: p.geography.distributors,
        ...(p.planUrl ? { planUrl: p.planUrl } : {}),
        link: planLink(p, pc),
        sourceLastUpdated: p.sourceLastUpdated,
        pricesShown: !unknown,
        priceNote: unknown
          ? "Dollar amounts are withheld because whether the published amounts include GST has not been confirmed. Use the rate sheet link for prices."
          : "Amounts are shown including GST.",
        understood: p.understood,
        notUnderstood: p.notUnderstood,
        contracts,
        notice: NOTICE,
      };
      return found({ data, source, asOf: asOfFor([p]), ...(p.understood ? {} : { warnings: [`Parts of this plan's structure are not fully understood (${p.notUnderstood.join(", ")}). Check the rate sheet for the full terms.`] }) });
    }),
  render: (d) => {
    const out = [`**${d.planName}** (${d.retailer}), ${d.customerType.toLowerCase()} ${d.fuelType.toLowerCase()} ${d.planType.toLowerCase()} plan. Plan id: ${d.planId}. Distributors: ${d.distributors.join(", ") || "not stated"}.`, `Link: ${linkMarkdown(d.link)}`, `Source last updated: ${d.sourceLastUpdated.slice(0, 10)}. ${d.priceNote}`];
    for (const c of d.contracts) {
      out.push("", `### ${c.fuel === "ELECTRICITY" ? "Electricity" : "Gas"} (${c.pricingModel})`);
      for (const t of c.periods) out.push(`- ${t.name}${t.dates ? ` (${t.dates})` : ""}${t.dailySupply ? `, supply ${t.dailySupply}` : ""}${t.usage.length ? `; usage: ${t.usage.join("; ")}` : ""}`);
      if (c.controlledLoads.length) out.push(`- Controlled load: ${c.controlledLoads.join("; ")}`);
      if (c.solarFeedIn.length) out.push(`- Solar feed-in: ${c.solarFeedIn.join("; ")}`);
      for (const x of c.discounts) out.push(`- Discount, ${x.conditional ? "conditional" : "no conditions"}: ${x.name}${x.amount ? ` ${x.amount}` : ""}. Condition: ${x.condition}`);
      if (c.fees.length) out.push(`- Fees: ${c.fees.join("; ")}`);
      if (c.incentives.length) out.push(`- Incentives: ${c.incentives.join("; ")}`);
      if (c.eligibility.length) out.push(`- Eligibility: ${c.eligibility.join("; ")}`);
      if (c.terms.length) out.push(`- Terms: ${c.terms.join("; ")}`);
    }
    if (!d.understood) out.push("", `Not fully understood by Ask Righto: ${d.notUnderstood.join(", ")}. See the rate sheet for the complete terms.`);
    out.push("", ...linkNotes([d.link]), "", NOTICE);
    return out.join("\n");
  },
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<PlanData>;
      const d = r.data;
      const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
      const dual = d.contracts.length > 1;
      // Rates first: supply, usage, feed-in and discounts for each fuel, as in the text. Rates include GST as on an invoice.
      const rateFacts = d.contracts.flatMap((c) => {
        const tag = dual ? `${c.fuel === "ELECTRICITY" ? "Electricity" : "Gas"} ` : "";
        const supply = [...new Set(c.periods.map((t) => t.dailySupply).filter((x): x is string => !!x))];
        const usage = c.periods.flatMap((t) => (c.periods.length > 1 ? t.usage.map((u) => `${t.name}: ${u}`) : t.usage));
        return [
          ...(supply.length ? [{ label: `${tag}daily supply (inc GST)`, value: clip(supply.join("; "), 200) }] : []),
          ...(usage.length ? [{ label: `${tag}usage rates (inc GST)`, value: clip(usage.join("; "), 200) }] : []),
          ...(c.controlledLoads.length ? [{ label: `${tag}controlled load`, value: clip(c.controlledLoads.join("; "), 200) }] : []),
          ...(c.solarFeedIn.length ? [{ label: `${tag}solar feed-in (as published)`, value: clip(c.solarFeedIn.join("; "), 200) }] : []),
          ...(c.discounts.length
            ? [{ label: `${tag}discounts`, value: clip(c.discounts.map((x) => `${x.name}${x.amount ? ` ${x.amount}` : ""} (${x.conditional ? "conditions apply" : "no conditions"})`).join("; "), 200) }]
            : []),
        ];
      });
      const facts = [
        ...(d.pricesShown ? rateFacts : [{ label: "Prices", value: clip(d.priceNote, 200) }]),
      ].slice(0, 7);
      return inkview.entityCard({
        name: d.planName,
        kind: "other",
        tagline: clip(`${d.retailer} · ${d.fuelType.toLowerCase()} · ${d.planType.toLowerCase()}${d.distributors.length ? ` · ${d.distributors.join(", ")}` : ""}`, 200),
        description: NOTICE,
        facts: [...facts, { label: "Plan id", value: d.planId }],
        ...(d.link.url ? { links: [{ label: d.link.label, url: d.link.url }] } : {}),
        source: inkviewSource(r),
      });
    }),
});
