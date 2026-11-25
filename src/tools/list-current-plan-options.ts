import { createHash } from "node:crypto";
import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { ENERGY_DATASET_ID, withStore } from "../energy/index.js";
import { describeLayout, layoutId, layoutWindows, type LayoutWindow } from "../energy/layouts.js";
import { MONEY_SCALE } from "../energy/money.js";
import type { Contract, EnergyPlan, TariffPeriod } from "../energy/types.js";
import { asOfFor, badPostcode, checkPostcode, COVERAGE_STATES, inkview, inkviewResult, matchRetailer, NOTICE, source, tableMeta, uniqueDistributors } from "./energy-common.js";

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
  supplyChargePerDay: z.number().min(0).max(20).optional().describe("Daily supply charge from the invoice, GST inclusive, in dollars per day (for example 1.05 for 105 cents)"),
  singleRatePerUnit: z.number().min(0).max(5).optional().describe("Usage rate (GST inclusive, as on the invoice) in dollars per kWh (gas: per MJ) if the invoice shows a single rate"),
  peakRatePerUnit: z.number().min(0).max(5).optional().describe("Peak rate (GST inclusive, as on the invoice) in dollars per kWh from the invoice"),
  shoulderRatePerUnit: z.number().min(0).max(5).optional().describe("Shoulder rate (GST inclusive, as on the invoice) in dollars per kWh from the invoice"),
  offPeakRatePerUnit: z.number().min(0).max(5).optional().describe("Off-peak rate (GST inclusive, as on the invoice) in dollars per kWh from the invoice"),
  planCode: z.string().max(40).optional().describe("The plan or offer code printed on the invoice or fact sheet (for example MOM799904MR), if there is one. It identifies a plan exactly"),
  planName: z.string().max(80).optional().describe("The plan name the user says they are on, if they have no invoice at hand (for example Value Saver). Matched as words, never exactly: it only narrows the list for the user to pick from, and never selects a plan by itself"),
  showAllOptions: z.boolean().optional().describe("Set true only when the user cannot give any figure or code from the invoice: lists the retailer's options without narrowing"),
});

const OPTION_LIMIT = 8;
/** When the invoice figures narrow the list, more than this many equally good options means the user should say more. */
const NARROW_LIMIT = 4;
const LAYOUT_LIMIT = 9;

interface Summary {
  tariff: "single rate" | "time of use";
  seasonal: boolean;
  /** Dollars per day, GST exclusive as published. */
  supply: number | undefined;
  /** Each rate of the first tariff period, GST exclusive as published. A plan can have several bands of one type (every band labelled SHOULDER), told apart by their hours. */
  rates: RateEntry[];
  layout?: { id: string; hours: string };
  key: string;
}

const dollars = (scaled: number) => scaled / MONEY_SCALE;

interface RateEntry {
  /** PEAK, OFF_PEAK, SHOULDER, SHOULDER1 ... or "single". */
  type: string;
  /** The hours this rate applies to, in words; absent for a single rate. */
  hours?: string;
  value: number;
}

function periodRates(t: TariffPeriod): RateEntry[] {
  const out: RateEntry[] = [];
  if (t.timeOfUse?.length) {
    for (const r of t.timeOfUse) {
      if (!r.rates[0]) continue;
      const ws: LayoutWindow[] = (r.windows.length ? r.windows : [{ days: [] }]).map((w) => ({
        season: "year",
        band: r.type,
        days: [...w.days].map((d) => d.toUpperCase()).join(","),
        start: /^(\d{1,2}):?(\d{2})/.test(w.startTime ?? "") ? (w.startTime as string).replace(/^(\d{1,2}):?(\d{2}).*/, (_m, h: string, m: string) => `${h.padStart(2, "0")}:${m}`) : "",
        end: /^(\d{1,2}):?(\d{2})/.test(w.endTime ?? "") ? (w.endTime as string).replace(/^(\d{1,2}):?(\d{2}).*/, (_m, h: string, m: string) => `${h.padStart(2, "0")}:${m}`) : "",
      }));
      out.push({ type: r.type, hours: describeLayout(ws).replace(/^[A-Za-z0-9 -]+? (?=\d|midnight|noon|all day)/, ""), value: dollars(r.rates[0].unitPrice) });
    }
  } else if (t.singleRate?.[0]) out.push({ type: "single", value: dollars(t.singleRate[0].unitPrice) });
  return out;
}

function summarise(plan: EnergyPlan, fuel: "ELECTRICITY" | "GAS"): Summary | undefined {
  const c: Contract | undefined = fuel === "ELECTRICITY" ? plan.electricity : plan.gas;
  const first = c?.tariffPeriods[0];
  if (!c || !first) return undefined;
  const rates = periodRates(first);
  const w = layoutWindows(plan, fuel);
  const layout = w ? { id: layoutId(w), hours: describeLayout(w) } : undefined;
  const all = c.tariffPeriods.map((t) => ({ s: t.dailySupplyCharge, r: periodRates(t).map((x) => [x.type, x.hours ?? "", x.value]) }));
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

/**
 * Invoice figures include GST (Iven, 2026-11-20), so compare with the stored rate with GST added when it is stored exclusive
 * (`gstMultiplier` 1.1). An invoice prints a rounded figure, so two figures agree when they differ by no more than half a unit
 * of the last digit given: 1.1187 agrees within 0.00005, and 1.12 within 0.005. A looser fixed tolerance made plans
 * a tenth of a cent apart look identical.
 */
function decimals(n: number): number {
  const t = String(n);
  if (/e/i.test(t)) return 6;
  const dot = t.indexOf(".");
  return dot < 0 ? 0 : Math.min(6, t.length - dot - 1);
}
function agrees(hint: number, published: number, gstMultiplier: number): boolean {
  return Math.abs(hint - published * gstMultiplier) <= 0.5 * 10 ** -decimals(hint) + 1e-9;
}

export interface PlanOption {
  /** The plan id to pass to compare_energy_plans as currentPlanId: the first of planIds. */
  currentPlanId: string;
  planIds: string[];
  planNames: string[];
  moreIds: number;
  tariff: string;
  seasonal: boolean;
  supplyPerDayIncGst?: string;
  ratesIncGst: Array<{ band: string; hours?: string; perUnit: string }>;
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
  /** True when invoice figures or a plan code narrowed the list. */
  narrowed: boolean;
  /** True when the figures still leave more than a few equally good options: ask the user for more from the invoice. */
  tooMany: boolean;
  layouts: LayoutChoice[];
  nextStep: string;
  notice: string;
}

const NAME_STOP = new Set(["plan", "the", "and", "for", "energy", "home", "my", "a", "of", "on", "to"]);
/** Lower-case words of a plan name, without filler. */
const nameWords = (t: string): string[] => [...new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !NAME_STOP.has(w)))];

const fmt = (n: number) => `$${n.toFixed(4)}`;

export const listCurrentPlanOptions = defineTool({
  name: "list_current_plan_options",
  title: "List the retailer's plans to pick the current one",
  description:
    "Lists a short set of the retailer's plans on the user's network, merging identical rates and hours, each with its rates and band hours, for the user to pick the one they are on (or none of these, then pick the hours). Pass the retailer, network, customer type and the rates printed on the invoice (GST inclusive), or planName if there is no invoice; never a name, address, account or meter identifier. Never selects a plan itself. Not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: [ENERGY_DATASET_ID],
  meta: tableMeta("form"),
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

      const gst = plans[0]?.[args.fuelType === "ELECTRICITY" ? "electricity" : "gas"]?.gstBasis;
      const mult = gst === "EXCLUSIVE" ? 1.1 : 1;
      const showAmounts = gst !== "UNKNOWN";
      const hint = {
        supply: args.supplyChargePerDay,
        single: args.singleRatePerUnit,
        PEAK: args.peakRatePerUnit,
        SHOULDER: args.shoulderRatePerUnit,
        OFF_PEAK: args.offPeakRatePerUnit,
      };
      const rateHints = [hint.supply, hint.single, hint.PEAK, hint.SHOULDER, hint.OFF_PEAK].some((x) => x !== undefined);
      const code = args.planCode?.trim().toUpperCase().replace(/@.*$/, "");
      const wantWords = args.planName ? nameWords(args.planName) : [];
      const nameHint = wantWords.length > 0;
      if (!rateHints && !code && !nameHint && !args.showAllOptions) {
        return notFound(
          "needs_input",
          `${m.brandName} has ${groups.size} different sets of rates and hours on this network, too many to choose from without more. Ask the user to read from their invoice the daily supply charge, the usage rate or rates (a single rate, or peak, shoulder and off-peak), and the plan or offer code if it prints one, then call again with them (they include GST, as printed). If they have no invoice but know the plan name, call again with planName. Only if the user cannot give any of these, call again with showAllOptions true.`,
        );
      }
      const ranked = [...groups.values()].map(({ s, plans: ps }) => {
        const matchedOn: string[] = [];
        const notMatched: string[] = [];
        const check = (label: string, h: number | undefined, pub: number | undefined, _tol: number) => {
          if (h === undefined) return;
          if (pub !== undefined && agrees(h, pub, mult)) matchedOn.push(label);
          else notMatched.push(label);
        };
        check("daily supply charge", hint.supply, s.supply, 0);
        if (code) {
          if (ps.some((p) => p.planId.toUpperCase().replace(/@.*$/, "").startsWith(code))) matchedOn.push("plan code");
          else notMatched.push("plan code");
        }
        // A hint matches when any rate of that kind agrees: plans with several bands of one type have several values.
        const vals = (pick: (t: string) => boolean) => s.rates.filter((x) => pick(x.type)).map((x) => x.value);
        const checkAny = (label: string, h: number | undefined, pubs: number[], _tol: number) => {
          if (h === undefined) return;
          if (pubs.some((v) => agrees(h, v, mult))) matchedOn.push(label);
          else notMatched.push(label);
        };
        checkAny("single rate", hint.single, vals((t) => t === "single"), 0);
        // An invoice names bands peak, shoulder and off-peak, but some plans label every band SHOULDER: with no band of the kind named, any band rate may be the one.
        const anyBand = vals((t) => t !== "single");
        const kind = (pick: (t: string) => boolean) => (vals(pick).length ? vals(pick) : anyBand);
        checkAny("peak rate", hint.PEAK, kind((t) => t === "PEAK"), 0);
        checkAny("shoulder rate", hint.SHOULDER, kind((t) => /^SHOULDER/.test(t)), 0);
        checkAny("off-peak rate", hint.OFF_PEAK, kind((t) => t === "OFF_PEAK"), 0);
        // Words the stated plan name shares with any plan in the group: a hint, never a match by itself.
        const nameScore = nameHint ? Math.max(0, ...ps.map((p) => { const have = new Set(nameWords(p.displayName)); return wantWords.filter((w) => have.has(w)).length; })) : 0;
        return { s, ps, matchedOn, notMatched, nameScore };
      });
      ranked.sort((a, b) => b.matchedOn.length - a.matchedOn.length || a.notMatched.length - b.notMatched.length || b.nameScore - a.nameScore || b.ps.length - a.ps.length || a.s.key.localeCompare(b.s.key));

      // With invoice figures, show only the options that agree best: all that agree on every figure given, else those matching the most. Several that tie mean the user should say more.
      const narrowed = rateHints || Boolean(code) || nameHint;
      let kept = ranked;
      if (!rateHints && !code && nameHint) {
        // Name only: the options whose plan names share words with it, most shared words first.
        const best = Math.max(0, ...ranked.map((r) => r.nameScore));
        kept = best === 0 ? [] : ranked.filter((r) => r.nameScore > 0);
      } else if (narrowed) {
        const best = Math.max(0, ...ranked.map((r) => r.matchedOn.length));
        kept = best === 0 ? [] : ranked.filter((r) => r.matchedOn.length === best);
        const exact = kept.filter((r) => r.notMatched.length === 0);
        if (exact.length) kept = exact;
      }
      const tooMany = narrowed && kept.length > NARROW_LIMIT;
      const shownLimit = narrowed ? NARROW_LIMIT : OPTION_LIMIT;
      const options: PlanOption[] = kept.slice(0, shownLimit).map(({ s, ps, matchedOn, notMatched, nameScore }) => {
        // The plan the invoice's code names comes first, so the id passed on to compare is the household's own plan.
        const isCode = (id: string) => Boolean(code) && id.toUpperCase().replace(/@.*$/, "").startsWith(code!);
        const ids = ps.map((p) => p.planId).sort((x, y) => Number(isCode(y)) - Number(isCode(x)) || x.localeCompare(y));
        const names = [...new Set(ps.map((p) => p.displayName))].sort();
        return {
          currentPlanId: ids[0]!,
          planIds: ids.slice(0, 3),
          planNames: names.slice(0, 8),
          moreIds: Math.max(0, ids.length - 3),
          tariff: s.tariff,
          seasonal: s.seasonal,
          ...(showAmounts && s.supply !== undefined ? { supplyPerDayIncGst: fmt(s.supply * mult) } : {}),
          ratesIncGst: showAmounts ? s.rates.map((x) => ({ band: x.type === "single" ? "single rate" : x.type.toLowerCase().replace(/_/g, "-"), ...(x.hours ? { hours: x.hours } : {}), perUnit: fmt(x.value * mult) })) : [],
          ...(s.layout ? { layoutId: s.layout.id, hours: s.layout.hours } : {}),
          matchedOn: nameScore > 0 ? [...matchedOn, "words of the plan name you gave"] : matchedOn,
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
        optionsNotShown: narrowed ? Math.max(0, kept.length - options.length) : Math.max(0, groups.size - options.length),
        narrowed,
        tooMany,
        layouts,
        nextStep: tooMany
          ? "Several options agree equally with the figures given. Do not ask the user to choose yet: ask them for more from the invoice (every rate printed, the daily supply charge, and the plan or offer code if there is one), then call again. Do not match by plan name."
          : narrowed && options.length === 0 && nameHint && !rateHints && !code
            ? "No plan name in this retailer's list on this network shares a word with the name given. Say so, then show the band hours below and ask which matches the user's plan, or let them state the hours; or ask them for the plan or offer code or an invoice rate."
          : narrowed && options.length === 0
            ? "Nothing in this retailer's list agrees with the figures given. Check them with the user (rates on an invoice include GST; a rate is per kWh in dollars), or ask for the plan or offer code, or show the band hours below and ask which matches their invoice or fact sheet, or let them state the hours."
            : "Show these options in plain words and ask the user to pick the one their invoice is on, or say none of these. If none, show the band hours below and ask which matches their invoice or fact sheet, or let them state the hours. Then call compare_energy_plans with currentPlanId (the chosen option's currentPlanId, a plan id containing @, copied unchanged) or hoursLayoutId. Do not choose for the user and do not match by plan name.",
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
      out.push(`**Option ${i + 1}** (currentPlanId ${o.currentPlanId}): ${o.tariff}${o.seasonal ? ", seasonal (first season shown)" : ""}.`);
      out.push(`- Plans: ${o.planNames.join("; ")}. Plan ids: ${o.planIds.join(", ")}${o.moreIds ? ` and ${o.moreIds} more` : ""}.`);
      if (o.supplyPerDayIncGst) out.push(`- Daily supply charge: ${o.supplyPerDayIncGst}/day.`);
      if (o.ratesIncGst.length) out.push(`- Rates: ${o.ratesIncGst.map((r) => `${r.band}${r.hours ? ` ${r.hours}` : ""} ${r.perUnit}/${d.fuelType === "GAS" ? "MJ" : "kWh"}`).join("; ")}.`);
      if (o.hours) out.push(`- Hours: ${o.hours} (hours id ${o.layoutId}).`);
      if (o.matchedOn.length) out.push(`- Matched your invoice on: ${o.matchedOn.join(", ")}.`);
      if (o.notMatched.length) out.push(`- Did not match your invoice on: ${o.notMatched.join(", ")}.`);
      out.push("");
    });
    if (d.optionsNotShown) out.push(`${d.optionsNotShown} more option${d.optionsNotShown === 1 ? " is" : "s are"} not shown. Give more of what is printed on the invoice (every rate, the daily supply charge, the plan or offer code) to narrow the list.`, "");
    if (d.layouts.length) {
      out.push("If none of these is the user's plan, these are the band hours this retailer uses on this network:");
      d.layouts.forEach((l, i) => out.push(`${i + 1}. ${l.hours} (hours id ${l.layoutId}; ${l.plans} plan${l.plans === 1 ? "" : "s"})`));
      out.push("");
    }
    out.push(d.nextStep, "", d.notice);
    return out.join("\n");
  },
  decorate: (result) => {
    if (!result.found) return undefined;
    const cur = (result as Found<CurrentPlanData>).data;
    // Only a short, settled list is drawn as a form: when the figures leave too many, or none, the host asks the user for more instead.
    if (cur.tooMany || cur.options.length === 0) return undefined;
    return inkviewResult(result, () => {
      const d = cur;
      const unit = d.fuelType === "GAS" ? "MJ" : "kWh";
      const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
      // The form's choices are capped at 80 characters each, so they carry the headline only; the full text beside the form has every rate, hour and plan id.
      const options = d.options.map((o, i) => {
        const vals = o.ratesIncGst.map((r) => Number(r.perUnit.slice(1))).filter((v) => Number.isFinite(v));
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        const rate = vals.length ? (lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)}-$${hi.toFixed(2)}`) + `/${unit}` : "";
        const first = clip(o.planNames.slice(0, 2).join(" / ") || "plan", 30) + (o.planNames.length > 2 ? ` +${o.planNames.length - 2}` : "");
        const sup = o.supplyPerDayIncGst ? `$${Number(o.supplyPerDayIncGst.slice(1)).toFixed(2)}/day` : "";
        return clip(`Option ${i + 1}: ${first}, ${[sup, rate].filter(Boolean).join(", ")}${o.matchedOn.length ? " (matches)" : ""}`, 80);
      });
      const none = "None of these is my plan";
      const fields: Array<Record<string, unknown>> = [
        { name: "currentPlan", label: "Which option is on your invoice?", type: "select", required: true, options: [...options, none], help: "The rates include GST, as on an invoice." },
      ];
      if (d.layouts.length) {
        fields.push({
          name: "hours",
          label: "If none: which band hours match your invoice?",
          type: "select",
          options: [...d.layouts.map((l, i) => clip(`Hours ${i + 1}: ${l.hours}`, 80)), "I will tell you the hours"],
        });
      }
      return inkview.form({
        title: `${d.retailer} ${d.fuelType.toLowerCase()} plans${d.distributor ? ` on ${d.distributor}` : ""}, postcode ${d.postcode}`,
        intro: clip(`${d.totalPlans} plans in ${d.options.length + d.optionsNotShown} groups of identical rates and hours. Pick the one your invoice is on so the comparison uses your own hours.`, 280),
        submitLabel: "Use this plan",
        fields,
      } as never);
    });
  },
});
