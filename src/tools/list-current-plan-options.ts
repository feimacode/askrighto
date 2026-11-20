import { createHash } from "node:crypto";
import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import { describeLayout, layoutId, layoutWindows } from "../energy/layouts.js";
import { MONEY_SCALE } from "../energy/money.js";
import type { Contract, EnergyPlan, TariffPeriod } from "../energy/types.js";
import { asOfFor, badPostcode, checkPostcode, COVERAGE_STATES, matchRetailer, NOTICE, source, tableMeta, uniqueDistributors } from "./energy-common.js";

/**
 * add-energy-invoice-first: helps a person say which plan (or which band hours) their invoice is on,
 * without matching by name. Takes no name, address, account number or meter identifier, and keeps nothing.
 */
const input = z.object({
  postcode: z.string().describe("Four-digit Australian postcode of the property, e.g. 3000"),
  fuelType: z.enum(["ELECTRICITY", "GAS"]).describe("Which fuel the invoice is for"),
  customerType: z.enum(["RESIDENTIAL", "BUSINESS"]).describe("Ask the user whether the plan is for a home or a business (including small business); never assume"),
  retailer: z.string().min(1).max(80).describe("The retailer on the invoice, e.g. Origin"),
  distributor: z.string().max(80).optional().describe("Distribution network from the invoice, required when the postcode has several"),
  supplyChargePerDay: z.number().min(0).max(20).optional().describe("Daily supply charge from the invoice in dollars per day (for example 1.05 for 105 cents)"),
  singleRatePerUnit: z.number().min(0).max(5).optional().describe("Usage rate in dollars per kWh (gas: per MJ) if the invoice shows a single rate"),
  peakRatePerUnit: z.number().min(0).max(5).optional().describe("Peak rate in dollars per kWh from the invoice"),
  shoulderRatePerUnit: z.number().min(0).max(5).optional().describe("Shoulder rate in dollars per kWh from the invoice"),
  offPeakRatePerUnit: z.number().min(0).max(5).optional().describe("Off-peak rate in dollars per kWh from the invoice"),
  ratesIncludeGst: z.boolean().optional().describe("true if the invoice rates include GST (most do), false if they exclude it. Leave out if unclear: both are tried"),
});

const OPTION_LIMIT = 8;
const LAYOUT_LIMIT = 9;

interface Summary {
  tariff: "single rate" | "time of use";
  seasonal: boolean;
  /** Dollars per day, GST exclusive as published. */
  supply: number | undefined;
  /** Band or "single" to dollars per unit, GST exclusive as published (first tariff period). */
  rates: Record<string, number>;
  layout?: { id: string; hours: string };
  key: string;
}

const dollars = (scaled: number) => scaled / MONEY_SCALE;

function periodRates(t: TariffPeriod): Record<string, number> {
  const out: Record<string, number> = {};
  if (t.timeOfUse?.length) {
    for (const r of t.timeOfUse) if (r.rates[0]) out[r.type] = dollars(r.rates[0].unitPrice);
  } else if (t.singleRate?.[0]) out.single = dollars(t.singleRate[0].unitPrice);
  return out;
}

function summarise(plan: EnergyPlan, fuel: "ELECTRICITY" | "GAS"): Summary | undefined {
  const c: Contract | undefined = fuel === "ELECTRICITY" ? plan.electricity : plan.gas;
  const first = c?.tariffPeriods[0];
  if (!c || !first) return undefined;
  const rates = periodRates(first);
  const w = layoutWindows(plan, fuel);
  const layout = w ? { id: layoutId(w), hours: describeLayout(w) } : undefined;
  const all = c.tariffPeriods.map((t) => ({ s: t.dailySupplyCharge, r: periodRates(t) }));
  const key = createHash("sha256").update(JSON.stringify({ all, layout: layout?.id ?? null, gst: c.gstBasis })).digest("hex").slice(0, 8);
  return {
    tariff: w ? "time of use" : "single rate",
    seasonal: c.tariffPeriods.length > 1,
    supply: first.dailySupplyCharge === undefined ? undefined : dollars(first.dailySupplyCharge),
    rates,
    ...(layout ? { layout } : {}),
    key,
  };
}

/** True when the invoice figure equals the published (GST exclusive) value either as published or with GST added. */
function agrees(hint: number, published: number, includesGst: boolean | undefined, tol: number): boolean {
  const plain = Math.abs(hint - published) <= tol;
  const withGst = Math.abs(hint - published * 1.1) <= tol * 1.1;
  return includesGst === true ? withGst : includesGst === false ? plain : plain || withGst;
}

export interface PlanOption {
  optionId: string;
  planIds: string[];
  planNames: string[];
  moreIds: number;
  tariff: string;
  seasonal: boolean;
  supplyPerDayIncGst?: string;
  ratesIncGst: Array<{ band: string; perUnit: string }>;
  layoutId?: string;
  hours?: string;
  matchedOn: string[];
  notMatched: string[];
}

export interface LayoutChoice {
  layoutId: string;
  hours: string;
  plans: number;
}

export interface CurrentPlanData {
  postcode: string;
  fuelType: string;
  customerType: string;
  retailer: string;
  distributor?: string;
  totalPlans: number;
  options: PlanOption[];
  optionsNotShown: number;
  layouts: LayoutChoice[];
  nextStep: string;
  notice: string;
}

const fmt = (n: number) => `$${n.toFixed(4)}`;

export const listCurrentPlanOptions = defineTool({
  name: "list_current_plan_options",
  title: "List the retailer's plans to pick the current one",
  description:
    "Use after reading the user's latest invoice. Lists a short set of the retailer's plans on the user's network, merging plans with identical rates and hours, each in plain words with its rates and band hours, so the user can pick the one their invoice is on, or say none of these (then pick the band hours from the layouts returned). Pass only the retailer, network, customer type and the rate figures printed on the invoice; never pass a name, address, account number or meter identifier. Does not match by plan name. Not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("data_table"),
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    return withStore<CurrentPlanData>(async (store) => {
      const all = await store.plans({ postcode, customerType: args.customerType });
      const withFuel = all.filter((p) => (args.fuelType === "ELECTRICITY" ? p.electricity : p.gas));
      if (withFuel.length === 0) {
        return notFound("outside_coverage", `No ${args.customerType.toLowerCase()} ${args.fuelType.toLowerCase()} plans are stored for postcode ${postcode}. The data covers ${COVERAGE_STATES}.`, { states: COVERAGE_STATES });
      }
      const m = matchRetailer(withFuel, args.retailer);
      if (!m) return notFound("not_in_dataset", `No retailer matching "${args.retailer}" has ${args.customerType.toLowerCase()} ${args.fuelType.toLowerCase()} plans at ${postcode}. The plan may not be in the data; ask the user for the band hours instead.`);
      if ("candidates" in m) return notFound("needs_input", `"${args.retailer}" could match more than one retailer. Ask the user which one is on the invoice.`, { candidates: m.candidates.map((c) => c.brandName) });
      let plans = withFuel.filter((p) => p.brandName === m.brandName);
      const nets = uniqueDistributors(plans.flatMap((p) => p.geography.distributors));
      let distributor = args.distributor;
      if (distributor) {
        const match = nets.find((n) => n.toLowerCase() === distributor!.toLowerCase());
        if (nets.length && !match) return notFound("needs_input", `"${distributor}" is not a distributor for this postcode. Ask the user which one is on the invoice.`, { distributors: nets });
        distributor = match ?? distributor;
        plans = plans.filter((p) => p.geography.distributors.some((x) => x.toLowerCase() === distributor!.toLowerCase()));
      } else if (nets.length > 1) {
        return notFound("needs_input", "This postcode has more than one distributor, and plans differ by network. Ask the user which distributor is on the invoice, then call again with distributor.", { distributors: nets });
      }

      // Group plans with identical rates and hours into one option.
      const groups = new Map<string, { s: Summary; plans: EnergyPlan[] }>();
      for (const p of plans) {
        const s = summarise(p, args.fuelType);
        if (!s) continue;
        const g = groups.get(s.key);
        if (g) g.plans.push(p);
        else groups.set(s.key, { s, plans: [p] });
      }

      const hint = {
        supply: args.supplyChargePerDay,
        single: args.singleRatePerUnit,
        PEAK: args.peakRatePerUnit,
        SHOULDER: args.shoulderRatePerUnit,
        OFF_PEAK: args.offPeakRatePerUnit,
      };
      const ranked = [...groups.values()].map(({ s, plans: ps }) => {
        const matchedOn: string[] = [];
        const notMatched: string[] = [];
        const check = (label: string, h: number | undefined, pub: number | undefined, tol: number) => {
          if (h === undefined) return;
          if (pub !== undefined && agrees(h, pub, args.ratesIncludeGst, tol)) matchedOn.push(label);
          else notMatched.push(label);
        };
        check("daily supply charge", hint.supply, s.supply, 0.006);
        check("single rate", hint.single, s.rates.single, 0.0006);
        check("peak rate", hint.PEAK, s.rates.PEAK, 0.0006);
        const shoulder = Object.entries(s.rates).find(([k]) => /^SHOULDER/.test(k))?.[1];
        check("shoulder rate", hint.SHOULDER, shoulder, 0.0006);
        check("off-peak rate", hint.OFF_PEAK, s.rates.OFF_PEAK, 0.0006);
        return { s, ps, matchedOn, notMatched };
      });
      ranked.sort((a, b) => b.matchedOn.length - a.matchedOn.length || a.notMatched.length - b.notMatched.length || b.ps.length - a.ps.length || a.s.key.localeCompare(b.s.key));

      const gst = plans[0]?.[args.fuelType === "ELECTRICITY" ? "electricity" : "gas"]?.gstBasis;
      const mult = gst === "EXCLUSIVE" ? 1.1 : 1;
      const showAmounts = gst !== "UNKNOWN";
      const options: PlanOption[] = ranked.slice(0, OPTION_LIMIT).map(({ s, ps, matchedOn, notMatched }) => {
        const ids = ps.map((p) => p.planId).sort();
        const names = [...new Set(ps.map((p) => p.displayName))].sort();
        return {
          optionId: s.key,
          planIds: ids.slice(0, 3),
          planNames: names.slice(0, 3),
          moreIds: Math.max(0, ids.length - 3),
          tariff: s.tariff,
          seasonal: s.seasonal,
          ...(showAmounts && s.supply !== undefined ? { supplyPerDayIncGst: fmt(s.supply * mult) } : {}),
          ratesIncGst: showAmounts ? Object.entries(s.rates).map(([band, v]) => ({ band: band === "single" ? "single rate" : band.toLowerCase().replace(/_/g, "-"), perUnit: fmt(v * mult) })) : [],
          ...(s.layout ? { layoutId: s.layout.id, hours: s.layout.hours } : {}),
          matchedOn,
          notMatched,
        };
      });

      // The fallback: the band-hour layouts this retailer uses on this network, most plans first.
      const byLayout = new Map<string, LayoutChoice>();
      for (const { s, plans: ps } of groups.values()) {
        if (!s.layout) continue;
        const cur = byLayout.get(s.layout.id);
        if (cur) cur.plans += ps.length;
        else byLayout.set(s.layout.id, { layoutId: s.layout.id, hours: s.layout.hours, plans: ps.length });
      }
      const layouts = [...byLayout.values()].sort((a, b) => b.plans - a.plans || a.layoutId.localeCompare(b.layoutId)).slice(0, LAYOUT_LIMIT);

      const data: CurrentPlanData = {
        postcode,
        fuelType: args.fuelType,
        customerType: args.customerType,
        retailer: m.brandName,
        ...(distributor ? { distributor } : nets[0] ? { distributor: nets[0] } : {}),
        totalPlans: plans.length,
        options,
        optionsNotShown: Math.max(0, groups.size - options.length),
        layouts,
        nextStep:
          "Show these options in plain words and ask the user to pick the one their invoice is on, or say none of these. If none, show the band hours below and ask which matches their invoice or fact sheet, or let them state the hours. Then call compare_energy_plans with currentPlanId (an id from the chosen option) or hoursLayoutId. Do not choose for the user and do not match by plan name.",
        notice: NOTICE,
      };
      return found({ data, source, asOf: asOfFor(plans) });
    });
  },
  render: (d) => {
    const out = [
      `${d.totalPlans} ${d.customerType.toLowerCase()} ${d.fuelType.toLowerCase()} plan${d.totalPlans === 1 ? "" : "s"} from ${d.retailer}${d.distributor ? ` on ${d.distributor}` : ""} at postcode ${d.postcode}, grouped into ${d.options.length + d.optionsNotShown} option${d.options.length + d.optionsNotShown === 1 ? "" : "s"} by identical rates and hours. Amounts include GST.`,
      "",
    ];
    d.options.forEach((o, i) => {
      out.push(`**Option ${i + 1}** (id ${o.optionId}): ${o.tariff}${o.seasonal ? ", seasonal (first season shown)" : ""}.`);
      out.push(`- Plans: ${o.planNames.join("; ")}${o.moreIds ? ` and ${o.moreIds} more` : ""}. Plan ids: ${o.planIds.join(", ")}.`);
      if (o.supplyPerDayIncGst) out.push(`- Daily supply charge: ${o.supplyPerDayIncGst}/day.`);
      if (o.ratesIncGst.length) out.push(`- Rates: ${o.ratesIncGst.map((r) => `${r.band} ${r.perUnit}/${d.fuelType === "GAS" ? "MJ" : "kWh"}`).join("; ")}.`);
      if (o.hours) out.push(`- Hours: ${o.hours} (hours id ${o.layoutId}).`);
      if (o.matchedOn.length) out.push(`- Matched your invoice on: ${o.matchedOn.join(", ")}.`);
      if (o.notMatched.length) out.push(`- Did not match your invoice on: ${o.notMatched.join(", ")}.`);
      out.push("");
    });
    if (d.optionsNotShown) out.push(`${d.optionsNotShown} more option${d.optionsNotShown === 1 ? " is" : "s are"} not shown. Give the rates printed on the invoice to narrow the list.`, "");
    if (d.layouts.length) {
      out.push("If none of these is the user's plan, these are the band hours this retailer uses on this network:");
      d.layouts.forEach((l, i) => out.push(`${i + 1}. ${l.hours} (hours id ${l.layoutId}; ${l.plans} plan${l.plans === 1 ? "" : "s"})`));
      out.push("");
    }
    out.push(d.nextStep, "", d.notice);
    return out.join("\n");
  },
});
