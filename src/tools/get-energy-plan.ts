import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import { formatMoney } from "../energy/money.js";
import type { Contract, Rate, TimeOfUseRate } from "../energy/types.js";
import { asOfFor, fmtRate, incGst, inkview, inkviewResult, inkviewSource, NOTICE, source, tableMeta } from "./energy-common.js";

const input = z.object({
  planId: z.string().min(1).describe("Plan id from search_energy_plans"),
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
  retailer: string;
  planName: string;
  fuelType: string;
  planType: string;
  distributors: string[];
  planUrl?: string;
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
  return {
    fuel,
    pricingModel: c.pricingModel,
    gstBasis: c.gstBasis,
    periods: c.tariffPeriods.map((t) => ({
      name: t.displayName ?? "Tariff period",
      ...(t.startDate || t.endDate ? { dates: `${t.startDate ?? "?"} to ${t.endDate ?? "?"}` } : {}),
      ...(t.dailySupplyCharge !== undefined && money(t.dailySupplyCharge) ? { dailySupply: `${money(t.dailySupplyCharge)}/day` } : {}),
      usage: t.timeOfUse ? touText(c, t.timeOfUse) : t.singleRate ? ratesText(c, t.singleRate) : t.hasDemandCharges ? ["demand charges (see the plan link)"] : [],
    })),
    controlledLoads: c.controlledLoads.map((cl) => {
      const s = money(cl.dailySupplyCharge);
      return `${cl.displayName ?? "Controlled load"}: ${cl.singleRate ? ratesText(c, cl.singleRate).join(", ") : cl.timeOfUse ? touText(c, cl.timeOfUse).join("; ") : "see plan"}${s ? `, supply ${s}/day` : ""}`;
    }),
    solarFeedIn: c.solarFeedIn.map((f) => `${f.displayName ?? "Feed-in"}${f.scheme ? ` (${f.scheme.toLowerCase()})` : ""}: ${f.timeVarying ? "varies by time, " : ""}${ratesText(c, f.rates).join(", ")}`),
    // Discounts always keep their published condition and are never folded into a rate.
    discounts: c.discounts.map((d) => ({
      name: d.displayName ?? d.category ?? "Discount",
      conditional: d.conditional,
      condition: d.conditional ? [d.category?.toLowerCase().replace(/_/g, " "), d.description].filter(Boolean).join(": ") || "conditions apply, see the plan link" : "applies without conditions",
      ...(d.percent ? { amount: `${Math.round(Number(d.percent) * 1000) / 10}% (${d.method})` } : d.amount !== undefined && money(d.amount) ? { amount: `${money(d.amount)} (${d.method})` } : {}),
    })),
    fees: c.fees.map((f) => `${(f.type ?? "fee").toLowerCase().replace(/_/g, " ")}${f.term ? ` (${f.term.toLowerCase()})` : ""}${f.amount !== undefined && money(f.amount) ? `: ${money(f.amount)}` : f.rate ? `: ${f.rate}` : ""}${f.description ? ` - ${f.description}` : ""}`),
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
    "Shows one energy plan in full from the AER's published plan data: supply charge, usage rates and blocks, time-of-use windows, controlled load, solar feed-in, discounts with their conditions, fees, eligibility and terms, with a link to the retailer's plan page. Use a plan id from search_energy_plans.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("entity_card"),
  handler: (args) =>
    withStore<PlanData>(async (store) => {
      const p = await store.plan(args.planId);
      if (!p) return notFound("not_in_dataset", `No current plan has the id "${args.planId}". Search by postcode with search_energy_plans to find valid plan ids.`);
      const contracts = [p.electricity ? view("ELECTRICITY", p.electricity) : undefined, p.gas ? view("GAS", p.gas) : undefined].filter((x): x is ContractView => !!x);
      const unknown = [p.electricity, p.gas].some((c) => c?.gstBasis === "UNKNOWN");
      const data: PlanData = {
        planId: p.planId,
        retailer: p.brandName,
        planName: p.displayName,
        fuelType: p.fuelType,
        planType: p.planType,
        distributors: p.geography.distributors,
        ...(p.planUrl ? { planUrl: p.planUrl } : {}),
        sourceLastUpdated: p.sourceLastUpdated,
        pricesShown: !unknown,
        priceNote: unknown
          ? "Dollar amounts are withheld because whether the published amounts include GST has not been confirmed. Use the plan link for prices."
          : "Amounts are shown including GST.",
        understood: p.understood,
        notUnderstood: p.notUnderstood,
        contracts,
        notice: NOTICE,
      };
      return found({ data, source, asOf: asOfFor([p]), ...(p.understood ? {} : { warnings: [`Parts of this plan's structure are not fully understood (${p.notUnderstood.join(", ")}). Check the plan link for the full terms.`] }) });
    }),
  render: (d) => {
    const out = [`**${d.planName}** (${d.retailer}), ${d.fuelType.toLowerCase()} ${d.planType.toLowerCase()} plan. Plan id: ${d.planId}. Distributors: ${d.distributors.join(", ") || "not stated"}.`, d.planUrl ? `Plan link: ${d.planUrl}` : "No plan link was published.", `Source last updated: ${d.sourceLastUpdated.slice(0, 10)}. ${d.priceNote}`];
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
    if (!d.understood) out.push("", `Not fully understood by Ask Righto: ${d.notUnderstood.join(", ")}. See the plan link for the complete terms.`);
    out.push("", NOTICE);
    return out.join("\n");
  },
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<PlanData>;
      const d = r.data;
      return inkview.entityCard({
        name: d.planName,
        kind: "other",
        tagline: `${d.retailer} · ${d.fuelType.toLowerCase()} · ${d.planType.toLowerCase()}`,
        description: NOTICE,
        facts: [
          { label: "Plan id", value: d.planId },
          { label: "Distributors", value: d.distributors.join(", ") || "not stated" },
          { label: "Source last updated", value: d.sourceLastUpdated.slice(0, 10) },
          ...d.contracts.flatMap((c) => c.discounts.slice(0, 3).map((x) => ({ label: `Discount (${x.conditional ? "conditional" : "no conditions"})`, value: `${x.name}: ${x.condition}` }))),
        ].slice(0, 8),
        ...(d.planUrl ? { links: [{ label: "Plan page", url: d.planUrl }] } : {}),
        source: inkviewSource(r),
      });
    }),
});
