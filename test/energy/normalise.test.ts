import { describe, expect, it } from "vitest";
import { stableHash } from "../../src/energy/hash.js";
import { formatMoney, parseMoney } from "../../src/energy/money.js";
import {
  isResidential,
  normalisePlan,
  readListItem,
} from "../../src/energy/normalise.js";
import { nextRunAt } from "../../src/energy/schedule.js";
import { fixture } from "./mock-cdr.js";

const norm = (name: string) => {
  const d = fixture(name);
  return normalisePlan("x", readListItem(d)!, d);
};

describe("money", () => {
  it("parses decimal strings into integers without float drift", () => {
    expect(parseMoney("0.28")).toBe(28_000);
    expect(parseMoney("1.1")).toBe(110_000);
    expect(parseMoney("0.123456")).toBe(12_346);
    expect(parseMoney("abc")).toBeUndefined();
    expect(parseMoney(undefined)).toBeUndefined();
    expect(formatMoney(28_000, 4)).toBe("0.2800");
  });
});

describe("normalisePlan", () => {
  it("single rate with discount and fee", () => {
    const { plan } = norm("single-rate");
    expect(plan.understood).toBe(true);
    expect(plan.electricity?.pricingModel).toBe("SINGLE_RATE");
    expect(plan.electricity?.tariffPeriods[0]).toMatchObject({
      dailySupplyCharge: 110_000,
      singleRate: [{ unitPrice: 28_000, measureUnit: "KWH" }],
    });
    expect(plan.electricity?.discounts[0]).toMatchObject({
      method: "percentOfBill",
      percent: "0.05",
      conditional: true,
    });
    expect(plan.electricity?.fees[0]).toMatchObject({
      type: "EXIT",
      amount: 5_000_000,
    });
    expect(plan.planUrl).toBe("https://example.test/plan/single");
    expect(plan.electricity?.gstBasis).toBe("EXCLUSIVE"); // confirmed 16 Nov 2026, see gst.ts
  });

  it("time of use with controlled load and feed-in", () => {
    const { plan } = norm("time-of-use");
    const tou = plan.electricity!.tariffPeriods[0]!.timeOfUse!;
    expect(tou.map((t) => t.type)).toEqual(["PEAK", "OFF_PEAK"]);
    expect(tou[0]!.windows[0]).toEqual({
      days: ["MON", "TUE", "WED", "THU", "FRI"],
      startTime: "1500",
      endTime: "2100",
    });
    expect(plan.electricity!.controlledLoads[0]).toMatchObject({
      dailySupplyCharge: 10_000,
      singleRate: [{ unitPrice: 15_000 }],
    });
    expect(plan.electricity!.solarFeedIn[0]).toMatchObject({
      scheme: "CURRENT",
      rates: [{ unitPrice: 5_000 }],
      timeVarying: false,
    });
  });

  it("block rates keep thresholds and periods; guaranteed discount is not conditional", () => {
    const { plan } = norm("block-rates-gas");
    expect(plan.gas!.tariffPeriods[0]!.singleRate).toEqual([
      { unitPrice: 3_500, measureUnit: "MJ", volume: 1000, period: "P1M" },
      { unitPrice: 3_000, measureUnit: "MJ" },
    ]);
    expect(plan.gas!.discounts[0]).toMatchObject({
      method: "fixedAmount",
      amount: 3_000_000,
      conditional: false,
    });
  });

  it("time-varying solar feed-in (v3 array shape, issue #8) is understood with its windows", () => {
    const { plan } = norm("solar-time-varying");
    expect(plan.notUnderstood).toEqual([]);
    const f = plan.electricity!.solarFeedIn[0]!;
    expect(f).toMatchObject({ scheme: "CURRENT", payerType: "RETAILER", timeVarying: true, rates: [] });
    expect(f.timeVaryingTariffs).toEqual([
      { type: "PEAK", displayName: "Evening", rates: [{ unitPrice: 8_000, measureUnit: "KWH" }], windows: [{ days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], startTime: "16:00", endTime: "21:00" }] },
      { type: "OFF_PEAK", displayName: "Rest of day", rates: [{ unitPrice: 2_000, measureUnit: "KWH" }], windows: [{ days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], startTime: "21:00", endTime: "16:00" }] },
    ]);
  });

  it("still reads the retired v2 single-object time-varying feed-in; flags a feed-in with neither shape", () => {
    const base = fixture("solar-time-varying") as Record<string, any>;
    const v2 = structuredClone(base);
    v2.electricityContract.solarFeedInTariff[0].timeVaryingTariffs = { type: "PEAK", rates: [{ unitPrice: "0.07" }], timeVariations: [{ days: ["MON"] }] };
    const a = normalisePlan("x", readListItem(v2)!, v2).plan;
    expect(a.understood).toBe(true);
    expect(a.electricity!.solarFeedIn[0]!.timeVaryingTariffs).toEqual([{ type: "PEAK", rates: [{ unitPrice: 7_000, measureUnit: "KWH" }], windows: [{ days: ["MON"] }] }]);

    const broken = structuredClone(base);
    delete broken.electricityContract.solarFeedInTariff[0].timeVaryingTariffs;
    expect(normalisePlan("x", readListItem(broken)!, broken).plan.notUnderstood).toContain("solarFeedIn:unknown_shape");
  });

  it("controlled load supply charge is read from inside the rate block, as the standards place it", () => {
    const d = fixture("time-of-use") as Record<string, any>;
    expect(d.electricityContract.controlledLoad[0].dailySupplyCharges).toBeUndefined();
    const { plan } = norm("time-of-use");
    expect(plan.electricity!.controlledLoads[0]!.dailySupplyCharge).toBe(10_000);
  });

  it("banded or missing supply charges are flagged, not silently dropped", () => {
    const d = structuredClone(fixture("single-rate")) as Record<string, any>;
    const tp = d.electricityContract.tariffPeriod[0];
    tp.dailySupplyChargeType = "BAND";
    delete tp.dailySupplyCharge;
    tp.bandedDailySupplyCharges = [{ unitPrice: "0.90", volume: 10 }, { unitPrice: "1.20" }];
    const a = normalisePlan("x", readListItem(d)!, d).plan;
    expect(a.notUnderstood).toContain("tariffPeriod:banded_supply_charge");
    expect(a.electricity!.tariffPeriods[0]!.bandedDailySupplyCharges).toHaveLength(2);

    delete tp.dailySupplyChargeType;
    delete tp.bandedDailySupplyCharges;
    expect(normalisePlan("x", readListItem(d)!, d).plan.notUnderstood).toContain("tariffPeriod:no_supply_charge");

    tp.dailySupplyCharges = "1.1"; // not in the standards, still accepted
    expect(normalisePlan("x", readListItem(d)!, d).plan.understood).toBe(true);
  });

  it("recorded AGL plan AGD812605MR: GST-exclusive rates match the fact sheet once GST is added", () => {
    const d = fixture("recorded/agl-AGD812605MR");
    const { plan } = normalisePlan("agl", readListItem(d)!, d);
    expect(plan.notUnderstood).toEqual([]);
    expect(plan.electricity!.gstBasis).toBe("EXCLUSIVE");
    const tp = plan.electricity!.tariffPeriods[0]!;
    // Fact sheet (incl. GST, released 10 Nov 2026): 104.18 c/day, 30.58 c/kWh 3pm-9pm, 18.24 c/kWh 9pm-3pm.
    const incGstCents = (u: number) => Math.round((u * 1.1) / 10) / 100;
    expect(incGstCents(tp.dailySupplyCharge!)).toBe(104.18);
    expect(tp.timeOfUse!.map((t) => incGstCents(t.rates[0]!.unitPrice))).toEqual([30.58, 18.24]);
    // AGL labels both bands SHOULDER; the windows are what tell them apart.
    expect(tp.timeOfUse!.map((t) => t.type)).toEqual(["SHOULDER", "SHOULDER"]);
    expect(plan.electricity!.solarFeedIn[0]).toMatchObject({ rates: [{ unitPrice: 500 }], timeVarying: false });
  });

  it("keeps an unknown pricing model and flags it", () => {
    const { plan } = norm("unknown-model");
    expect(plan.understood).toBe(false);
    expect(plan.notUnderstood).toEqual(
      expect.arrayContaining([
        "pricingModel:SPACE_BANDS",
        "rateBlockUType:mysteryRates",
      ]),
    );
    expect(plan.electricity?.pricingModel).toBe("SPACE_BANDS");
  });

  it("drops business plans at the list stage", () => {
    expect(isResidential(readListItem(fixture("business-list-item"))!)).toBe(
      false,
    );
    expect(isResidential(readListItem(fixture("single-rate"))!)).toBe(true);
  });

  it("hash ignores field order", () => {
    expect(stableHash({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } })).toBe(
      stableHash({ b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 }),
    );
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});

describe("nextRunAt", () => {
  it("finds 02:30 Sydney time, across daylight saving", () => {
    // 2026-11-13 12:00 UTC = 23:00 AEDT; next 02:30 AEDT is 2026-11-13 15:30 UTC
    expect(
      nextRunAt(
        new Date("2026-11-13T12:00:00Z"),
        2,
        30,
        "Australia/Sydney",
      ).toISOString(),
    ).toBe("2026-11-13T15:30:00.000Z");
    // winter: AEST is UTC+10, 02:30 = 16:30 UTC the day before
    expect(
      nextRunAt(
        new Date("2026-07-01T00:00:00Z"),
        2,
        30,
        "Australia/Sydney",
      ).toISOString(),
    ).toBe("2026-07-01T16:30:00.000Z");
  });
});
