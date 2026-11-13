import { describe, expect, it } from "vitest";
import { breakdownSum, estimateAnnualCost, type Estimate, type Usage } from "../../src/energy/calc.js";
import { normalisePlan, readListItem } from "../../src/energy/normalise.js";
import type { EnergyPlan, GstBasis } from "../../src/energy/types.js";
import { fixture } from "./mock-cdr.js";

export function planFrom(name: string, gst: GstBasis = "EXCLUSIVE"): EnergyPlan {
  const d = fixture(name);
  const { plan } = normalisePlan("x", readListItem(d)!, d);
  for (const c of [plan.electricity, plan.gas]) if (c) c.gstBasis = gst;
  return { ...plan, fetchedAt: "2026-11-13T00:00:00Z", verifiedAt: "2026-11-13T00:00:00Z" };
}

const elec = (annualUsage: number, extra: Partial<Usage> = {}): Usage => ({ fuel: "ELECTRICITY", annualUsage, ...extra });
const est = (p: EnergyPlan, u: Usage) => estimateAnnualCost(p, u) as Estimate;

describe("estimateAnnualCost golden cases", () => {
  it("single rate: supply 1.10 x 365 + 4000 kWh x 0.28, plus GST", () => {
    // supply 401.50 + usage 1120.00 = 1521.50; GST 152.15; total 1673.65
    const e = est(planFrom("single-rate"), elec(4000));
    expect(e.estimated).toBe(true);
    expect(e.breakdown).toMatchObject({ supplyCents: 40150, usageCents: 112000, controlledLoadCents: 0, feedInCreditCents: 0, guaranteedDiscountCents: 0, feesCents: 0, gstCents: 15215 });
    expect(e.totalCents).toBe(167365);
    // the 5% pay-on-time discount is listed, not applied
    expect(e.conditionalDiscounts).toHaveLength(1);
    expect(e.conditionalDiscounts[0]!.condition).toMatch(/pay on time/i);
    expect(e.totalIfConditionsMetCents).toBeLessThan(e.totalCents);
    expect(e.notIncluded.join(" ")).toMatch(/exit/);
  });

  it("two-block gas plan: 1000 MJ a month at 0.035 then 0.030", () => {
    // supply 0.80 x 365 = 292; usage 12 months x (1000 x 0.035 + 666.667 x 0.030) = 660; GST 95.20
    const e = est(planFrom("block-rates-gas"), { fuel: "GAS", annualUsage: 20000 });
    expect(e.breakdown.supplyCents).toBe(29200);
    expect(e.breakdown.usageCents).toBe(66000);
    expect(e.totalCents).toBe(104720);
    expect(e.notIncluded.join(" ")).toMatch(/Guaranteed/); // fixed-amount discount basis unclear: shown, not applied
  });

  it("time of use with shares, controlled load and solar export; shoulder joins peak when there is no shoulder rate", () => {
    const e = est(planFrom("time-of-use"), elec(4000, { shares: { peak: 25, shoulder: 25, offPeak: 50 }, controlledLoadAnnualKwh: 1000, solarExportAnnualKwh: 500 }));
    expect(e.breakdown.supplyCents).toBe(34675); // 0.95 x 365
    expect(e.breakdown.usageCents).toBe(126000); // 2000 x 0.45 + 2000 x 0.18
    expect(e.breakdown.controlledLoadCents).toBe(18650); // 1000 x 0.15 + 0.10 x 365
    expect(e.breakdown.feedInCreditCents).toBe(-2500); // 500 x 0.05, GST-free
    const taxable = 34675 + 126000 + 18650;
    expect(Math.abs(e.breakdown.gstCents - taxable / 10)).toBeLessThanOrEqual(0.5);
    expect(e.totalCents).toBe(breakdownSum(e.breakdown));
  });

  it("inclusive GST adds none", () => {
    const e = est(planFrom("single-rate", "INCLUSIVE"), elec(4000));
    expect(e.breakdown.gstCents).toBe(0);
    expect(e.totalCents).toBe(152150);
  });

  it("seasonal periods share usage by days", () => {
    const p = planFrom("single-rate");
    const t = p.electricity!.tariffPeriods[0]!;
    p.electricity!.tariffPeriods = [
      { ...t, startDate: "01-01", endDate: "06-30", singleRate: [{ unitPrice: 20_000, measureUnit: "KWH" }] }, // 181 days at 0.20
      { ...t, startDate: "07-01", endDate: "12-31", singleRate: [{ unitPrice: 40_000, measureUnit: "KWH" }] }, // 184 days at 0.40
    ];
    const e = est(p, elec(3650));
    // usage 10 kWh a day: 181 x 10 x 0.20 + 184 x 10 x 0.40 = 362 + 736 = 1098
    expect(e.breakdown.usageCents).toBe(109800);
    expect(e.breakdown.supplyCents).toBe(40150);
  });
});

describe("not estimated, never guessed", () => {
  it("needs a time-of-use split", () => {
    expect(estimateAnnualCost(planFrom("time-of-use"), elec(4000))).toMatchObject({ estimated: false, reason: "needs_time_of_use_split" });
  });
  it("GST basis unknown", () => {
    expect(estimateAnnualCost(planFrom("single-rate", "UNKNOWN"), elec(4000))).toMatchObject({ estimated: false, reason: "gst_basis_unknown" });
  });
  it("demand tariff", () => {
    const p = planFrom("single-rate");
    p.electricity!.tariffPeriods[0]!.hasDemandCharges = true;
    expect(estimateAnnualCost(p, elec(4000))).toMatchObject({ reason: "demand_tariff" });
  });
  it("not fully understood", () => {
    expect(estimateAnnualCost(planFrom("unknown-model"), elec(4000))).toMatchObject({ reason: "not_fully_understood" });
  });
  it("no controlled load rate", () => {
    expect(estimateAnnualCost(planFrom("single-rate"), elec(4000, { controlledLoadAnnualKwh: 500 }))).toMatchObject({ reason: "no_controlled_load_rate" });
  });
  it("missing rate", () => {
    const p = planFrom("single-rate");
    p.electricity!.tariffPeriods[0]!.singleRate = [];
    expect(estimateAnnualCost(p, elec(4000))).toMatchObject({ reason: "missing_rate" });
  });
  it("notes a plan with no feed-in when solar export was given", () => {
    const e = est(planFrom("single-rate"), elec(4000, { solarExportAnnualKwh: 800 }));
    expect(e.notes.join(" ")).toMatch(/no solar feed-in/);
    expect(e.breakdown.feedInCreditCents).toBe(0);
  });
});

describe("properties", () => {
  const names = ["single-rate", "time-of-use", "block-rates-gas", "unknown-model"];
  it("components always sum to the total, and results are deterministic", () => {
    for (const name of names) {
      for (const usage of [500, 2500, 4000, 9000, 25000]) {
        const p = planFrom(name);
        const fuel = p.fuelType === "GAS" ? "GAS" : "ELECTRICITY";
        const u: Usage = { fuel, annualUsage: usage, shares: { peak: 30, shoulder: 20, offPeak: 50 }, solarExportAnnualKwh: usage / 10 };
        const a = estimateAnnualCost(p, u);
        const b = estimateAnnualCost(planFrom(name), u);
        expect(a).toEqual(b);
        if (a.estimated) expect(a.totalCents).toBe(breakdownSum(a.breakdown));
      }
    }
  });
});
