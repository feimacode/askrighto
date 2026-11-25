/**
 * One contract of a plan as plain text rows: supply, usage rates and band hours (GST inclusive as on an invoice),
 * controlled load, feed-in, discounts with their conditions, fees, eligibility and terms.
 * Shared by get_energy_plan and compare_energy_plan_rates so both word a plan the same way.
 */
import { fmtRate, incGst } from "../tools/energy-common.js";
import { formatMoney } from "./money.js";
import type { Contract, Rate, TimeOfUseRate } from "./types.js";

export interface ContractView {
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

export function contractView(fuel: "ELECTRICITY" | "GAS", c: Contract): ContractView {
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

