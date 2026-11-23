import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import { linkMarkdown, linkNotes, planLink, type PlanLink } from "../energy/links.js";
import { formatMoney } from "../energy/money.js";
import type { Contract, Rate, TimeOfUseRate } from "../energy/types.js";
import { asOfFor, checkPostcode, fmtRate, incGst, inkview, inkviewResult, inkviewSource, NOTICE, source, tableMeta } from "./energy-common.js";

const input = z.object({
  planId: z.string().min(1).describe("Plan id from search_energy_plans"),
  postcode: z.string().optional().describe("Four-digit postcode of the property. Needed for the Energy Made Easy rate sheet link"),
});

interface ContractView {
  fuel: "ELECTRICITY" | "GAS";
  pricingModel: string;
  gstBasis: string;
  periods: Array<{ name: string; dates?: string; dailySupply?: string; usage: string[] }>;
  controlledLoads: string[];
  solarFeedIn: string[];
  discounts: Array<{ name: string; conditional: boolean; condition: string; amount?: string }>;
  fees: string[];
  incentives: string[];
  eligibility: string[];
  terms: string[];
}

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

const ratesText = (c: Contract, rs: Rate[]): string[] =>
  rs.map((r) => {
    const price = fmtRate(c, r.unitPrice, r.measureUnit) ?? "price withheld";
    return r.volume !== undefined ? `${price} for the first ${r.volume} ${r.measureUnit.toLowerCase()} per ${r.period ?? "period"}` : `${price}${rs.length > 1 ? " above that" : ""}`;
  });

/**
 * Feed-in credits are shown as published, with no GST added: a household that is not
 * registered for GST receives the credit without GST (the estimate treats it the same way).
 * Still withheld while the GST basis is unconfirmed, so no figure goes out unchecked.
 */
const feedInRatesText = (c: Contract, rs: Rate[]): string[] =>
  rs.map((r) => {
    const price = c.gstBasis === "UNKNOWN" ? "price withheld" : `${formatMoney(r.unitPrice, 4)}/${r.measureUnit === "KWH" ? "kWh" : r.measureUnit.toLowerCase()}`;
    return r.volume !== undefined ? `${price} for the first ${r.volume} ${r.measureUnit.toLowerCase()} per ${r.period ?? "period"}` : `${price}${rs.length > 1 ? " above that" : ""}`;
  });

const touText = (c: Contract, ts: TimeOfUseRate[]): string[] =>
  ts.map((t) => {
    const win = t.windows.map((w) => `${w.days.join("/")} ${w.startTime ?? ""}-${w.endTime ?? ""}`.trim()).join("; ");
    return `${t.type.replace(/_/g, " ").toLowerCase()}: ${ratesText(c, t.rates).join(", ")}${win ? ` (${win})` : ""}`;
  });

function view(fuel: "ELECTRICITY" | "GAS", c: Contract): ContractView {
  const money = (u: number | undefined) => {
    const v = incGst(c, u);
    return v === undefined ? undefined : `$${formatMoney(v, 2)}`;
  };
  // Fees are published including GST (AGL's fee descriptions say so; the standards are silent),
  // and the basis of fixed discount amounts is not described, so both are shown as published.
  const published = (u: number | undefined) => (u === undefined || c.gstBasis === "UNKNOWN" ? undefined : `$${formatMoney(u, 2)}`);
  return {
    fuel,
    pricingModel: c.pricingModel,
    gstBasis: c.gstBasis,
    periods: c.tariffPeriods.map((t) => ({
      name: t.displayName ?? "Tariff period",
      ...(t.startDate || t.endDate ? { dates: `${t.startDate ?? "?"} to ${t.endDate ?? "?"}` } : {}),
      ...(t.dailySupplyCharge !== undefined && money(t.dailySupplyCharge) ? { dailySupply: `${money(t.dailySupplyCharge)}/day` } : {}),
      usage: t.timeOfUse ? touText(c, t.timeOfUse) : t.singleRate ? ratesText(c, t.singleRate) : t.hasDemandCharges ? ["demand charges (see the rate sheet link)"] : [],
    })),
    controlledLoads: c.controlledLoads.map((cl) => {
      const s = money(cl.dailySupplyCharge);
      return `${cl.displayName ?? "Controlled load"}: ${cl.singleRate ? ratesText(c, cl.singleRate).join(", ") : cl.timeOfUse ? touText(c, cl.timeOfUse).join("; ") : "see plan"}${s ? `, supply ${s}/day` : ""}`;
    }),
    solarFeedIn: c.solarFeedIn.map((f) => {
      const head = `${f.displayName ?? "Feed-in"}${f.scheme ? ` (${f.scheme.toLowerCase()})` : ""}`;
      const body = f.timeVaryingTariffs?.length
        ? `varies by time: ${f.timeVaryingTariffs
            .map((t) => {
              const win = t.windows.map((w) => `${w.days.join("/")} ${w.startTime ?? ""}-${w.endTime ?? ""}`.trim()).join("; ");
              return `${t.displayName ?? t.type.replace(/_/g, " ").toLowerCase()}: ${feedInRatesText(c, t.rates).join(", ")}${win ? ` (${win})` : ""}`;
            })
            .join("; ")}`
        : feedInRatesText(c, f.rates).join(", ");
      return `${head}: ${body}`;
    }),
    // Discounts always keep their published condition and are never folded into a rate.
    discounts: c.discounts.map((d) => ({
      name: d.displayName ?? d.category ?? "Discount",
      conditional: d.conditional,
      condition: d.conditional ? [d.category?.toLowerCase().replace(/_/g, " "), d.description].filter(Boolean).join(": ") || "conditions apply, see the rate sheet link" : "applies without conditions",
      ...(d.percent ? { amount: `${Math.round(Number(d.percent) * 1000) / 10}% (${d.method})` } : d.amount !== undefined && published(d.amount) ? { amount: `${published(d.amount)} (${d.method}, as published)` } : {}),
    })),
    fees: c.fees.map((f) => `${(f.type ?? "fee").toLowerCase().replace(/_/g, " ")}${f.term ? ` (${f.term.toLowerCase()})` : ""}${f.amount !== undefined && published(f.amount) ? `: ${published(f.amount)}` : f.rate ? `: ${f.rate}` : ""}${f.description ? ` - ${f.description}` : ""}`),
    incentives: c.incentives.map((i) => [i.displayName, i.description].filter(Boolean).join(": ")),
    eligibility: c.eligibility.map((e) => [e.type, e.information ?? e.description].filter(Boolean).join(": ")),
    terms: [
      c.terms.termType ? `term: ${c.terms.termType}` : "",
      c.terms.billFrequency?.length ? `bills: ${c.terms.billFrequency.join(", ")}` : "",
      c.terms.paymentOptions?.length ? `payment: ${c.terms.paymentOptions.join(", ")}` : "",
      c.terms.coolingOffDays !== undefined ? `cooling off: ${c.terms.coolingOffDays} days` : "",
    ].filter(Boolean),
  };
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
