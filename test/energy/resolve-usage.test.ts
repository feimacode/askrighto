/**
 * resolveUsage and toCalcUsage, as tests of today's behaviour (restructure-energy-compare-usage, section 2).
 * Pure: no store. Includes the silent drops, so a later change to them shows up as a test change.
 */
import { describe, expect, it } from "vitest";
import { resolveUsage, toCalcUsage, type UsageArgs } from "../../src/energy/compare/resolve-usage.js";
import { profileFromUpload } from "../../src/energy/readings/upload.js";

type Ctx = { postcode: string; customerType: "RESIDENTIAL" | "BUSINESS" };
const ctx: Ctx = { postcode: "3000", customerType: "RESIDENTIAL" };
const elec = (a: Partial<UsageArgs> = {}): UsageArgs => ({ fuelType: "ELECTRICITY", ...a });
const gas = (a: Partial<UsageArgs> = {}): UsageArgs => ({ fuelType: "GAS", ...a });

function ok(args: UsageArgs, c: Ctx = ctx) {
  const r = resolveUsage(args, c);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.result)}`);
  return r.usage;
}
function refused(args: UsageArgs, c: Ctx = ctx): string {
  const r = resolveUsage(args, c);
  if (r.ok) throw new Error("expected a refusal");
  const g = r.result as { found: boolean; reason?: string; message?: string };
  expect(g.found).toBe(false);
  expect(g.reason).toBe("needs_input");
  return g.message ?? "";
}

/** Three days of E1 at 0.2 kWh a half hour (9.6 kWh a day), in market time. */
function sampleProfile(postcode = "3000"): string {
  const day = (d: string) => `300,${d},${Array(48).fill("0.200").join(",")},A,,,20261120010101,`;
  const text = ["200,6407000123,E1,E1,E1,,SERIAL1,KWH,30,", day("20260101"), day("20260102"), day("20260103")].join("\n");
  const r = profileFromUpload(text, postcode, 1_000_000);
  if (!r.ok) throw new Error(r.problem);
  return r.profile;
}

describe("resolveUsage: yearly and bill figures", () => {
  it("takes a yearly electricity figure as given, in kWh", () => {
    const u = ok(elec({ annualUsageKwh: 4200 }));
    expect(u).toMatchObject({ unit: "kWh", annual: 4200, useBenchmark: false });
    expect(u.scaledFromBill).toBeUndefined();
  });
  it("takes a yearly gas figure in MJ", () => {
    expect(ok(gas({ annualUsageMj: 50_000 }))).toMatchObject({ unit: "MJ", annual: 50_000 });
  });
  it("scales a bill to a year by its days", () => {
    const u = ok(elec({ billUsageKwh: 900, billDays: 90 }));
    expect(u.annual).toBeCloseTo(3650, 6);
    expect(u.scaledFromBill).toContain("900 kWh over 90 days scaled to a year (x 365/90)");
  });
  it("scales a gas bill in MJ", () => {
    const u = ok(gas({ billUsageMj: 5000, billDays: 60 }));
    expect(u.annual).toBeCloseTo((5000 * 365) / 60, 6);
    expect(u.scaledFromBill).toContain("MJ");
  });
  it("asks for billDays when a bill has none", () => {
    expect(refused(elec({ billUsageKwh: 900 }))).toMatch(/billDays/);
  });
  it("silent drop: a yearly figure wins over a bill figure, which is ignored", () => {
    const u = ok(elec({ annualUsageKwh: 4000, billUsageKwh: 900, billDays: 90 }));
    expect(u.annual).toBe(4000);
    expect(u.scaledFromBill).toBeUndefined();
  });
  it("silent drop: the electricity yearly field is not read for gas, so gas given kWh has no usage", () => {
    expect(refused(gas({ annualUsageKwh: 4000 }))).toMatch(/No usage was given/);
  });
  it("silent drop: the gas fields are not read for electricity", () => {
    expect(refused(elec({ annualUsageMj: 50_000, billUsageMj: 5000, billDays: 60 }))).toMatch(/No usage was given/);
  });
});

describe("resolveUsage: the peak, shoulder and off-peak split", () => {
  it("keeps a split that adds up to 100, missing bands counting as 0", () => {
    const u = ok(elec({ annualUsageKwh: 4000, peakSharePct: 40, offPeakSharePct: 60 }));
    expect(u.shares).toEqual({ peak: 40, shoulder: 0, offPeak: 60 });
  });
  it("allows half a point of rounding", () => {
    expect(ok(elec({ annualUsageKwh: 4000, peakSharePct: 33.3, shoulderSharePct: 33.3, offPeakSharePct: 33.4 })).shares).toBeDefined();
    expect(refused(elec({ annualUsageKwh: 4000, peakSharePct: 40, shoulderSharePct: 20, offPeakSharePct: 30 }))).toMatch(/add up to 90%, not 100%/);
  });
  it("refuses a split for gas", () => {
    expect(refused(gas({ annualUsageMj: 50_000, peakSharePct: 100 }))).toMatch(/electricity only/);
  });
  it("works with a bill figure too", () => {
    const u = ok(elec({ billUsageKwh: 900, billDays: 90, peakSharePct: 50, offPeakSharePct: 50 }));
    expect(u.shares).toEqual({ peak: 50, shoulder: 0, offPeak: 50 });
    expect(u.scaledFromBill).toBeDefined();
  });
});

describe("resolveUsage: typical usage", () => {
  it("needs usage unless typical usage is asked for, and offers it for a household", () => {
    expect(refused(elec())).toMatch(/useBenchmarkUsage true and householdSize/);
  });
  it("does not offer typical usage to a business", () => {
    const m = refused(elec(), { postcode: "3000", customerType: "BUSINESS" });
    expect(m).toMatch(/no typical usage for a business/);
    expect(m).not.toMatch(/useBenchmarkUsage/);
  });
  it("refuses typical usage for a business", () => {
    expect(refused(elec({ useBenchmarkUsage: true, householdSize: 2 }), { postcode: "3000", customerType: "BUSINESS" })).toMatch(/no benchmark for a business/);
  });
  it("needs the household size", () => {
    expect(refused(elec({ useBenchmarkUsage: true }))).toMatch(/householdSize/);
  });
  it("leaves the figure to the benchmark lookup", () => {
    const u = ok(elec({ useBenchmarkUsage: true, householdSize: 2 }));
    expect(u).toMatchObject({ useBenchmark: true, unit: "kWh" });
    expect(u.annual).toBeUndefined();
    expect(ok(gas({ useBenchmarkUsage: true, householdSize: 2 })).unit).toBe("MJ");
  });
  it("refuses a split, controlled load or solar with typical usage", () => {
    for (const extra of [{ peakSharePct: 50 }, { shoulderSharePct: 10 }, { offPeakSharePct: 50 }, { controlledLoadAnnualKwh: 500 }, { solarExportAnnualKwh: 800 }]) {
      expect(refused(elec({ useBenchmarkUsage: true, householdSize: 2, ...extra }))).toMatch(/cannot be combined with typical usage/);
    }
  });
  it("silent drop: typical usage is ignored when any usage is given", () => {
    const u = ok(elec({ annualUsageKwh: 4000, useBenchmarkUsage: true, householdSize: 2 }));
    expect(u).toMatchObject({ useBenchmark: false, annual: 4000 });
  });
  it("silent drop: householdSize without useBenchmarkUsage is not used", () => {
    expect(refused(elec({ householdSize: 2 }))).toMatch(/No usage was given/);
  });
});

describe("resolveUsage: interval readings", () => {
  it("uses the profile's own annual figure and keeps it as verified when it came from our tool", () => {
    const u = ok(elec({ readingsProfile: sampleProfile() }));
    expect(u.annual).toBeCloseTo(9.6 * 365, 3);
    expect(u.readingsVerified).toBe(true);
    expect(u.profile?.daysPresent).toBe(3);
    expect(u.ignored).toBeUndefined();
  });
  it("silent drop, but listed in ignored: a bill or yearly figure and a split given with readings", () => {
    const u = ok(elec({ readingsProfile: sampleProfile(), annualUsageKwh: 4000, peakSharePct: 40, offPeakSharePct: 60 }));
    expect(u.annual).toBeCloseTo(9.6 * 365, 3);
    expect(u.shares).toBeUndefined();
    expect(u.ignored).toBe("The readings were used; the bill or yearly usage figure and the peak, shoulder and off-peak split given with them was not used.");
  });
  it("lists only what was given", () => {
    expect(ok(elec({ readingsProfile: sampleProfile(), billUsageKwh: 900 })).ignored).toMatch(/the bill or yearly usage figure given with them/);
    expect(ok(elec({ readingsProfile: sampleProfile(), peakSharePct: 50 })).ignored).toMatch(/the peak, shoulder and off-peak split given/);
  });
  it("silent drop: typical usage given with readings is not mentioned", () => {
    const u = ok(elec({ readingsProfile: sampleProfile(), useBenchmarkUsage: true, householdSize: 2 }));
    expect(u).toMatchObject({ useBenchmark: false });
    expect(u.ignored).toBeUndefined();
  });
  it("is for electricity only", () => {
    expect(refused(gas({ readingsProfile: sampleProfile() }))).toMatch(/electricity only/);
  });
  it("refuses a profile that cannot be decoded", () => {
    expect(refused(elec({ readingsProfile: "{not json" }))).toMatch(/could not be used/);
  });
  it("refuses a profile built for another state's postcode", () => {
    expect(refused(elec({ readingsProfile: sampleProfile("2000") }))).toMatch(/built for a NSW postcode/);
  });
  it("marks a profile whose signature does not check as unverified", () => {
    const p = JSON.parse(sampleProfile());
    p.sig = "tampered";
    const u = ok(elec({ readingsProfile: JSON.stringify(p) }));
    expect(u.readingsVerified).toBe(false);
  });
});

describe("toCalcUsage", () => {
  it("customer usage carries the split, controlled load and solar", () => {
    const args = elec({ annualUsageKwh: 4000, peakSharePct: 40, offPeakSharePct: 60, controlledLoadAnnualKwh: 500, solarExportAnnualKwh: 800 });
    const u = toCalcUsage(ok(args), args);
    expect(u).toMatchObject({ fuel: "ELECTRICITY", annualUsage: 4000, basis: "customer", shares: { peak: 40, shoulder: 0, offPeak: 60 }, controlledLoadAnnualKwh: 500, solarExportAnnualKwh: 800 });
  });
  it("controlled load and solar are not applied to gas", () => {
    const args = gas({ annualUsageMj: 50_000, controlledLoadAnnualKwh: 500, solarExportAnnualKwh: 800 });
    const u = toCalcUsage(ok(args), args);
    expect(u.controlledLoadAnnualKwh).toBeUndefined();
    expect(u.solarExportAnnualKwh).toBeUndefined();
  });
  it("readings usage has band shares from the profile, and no solar export without a B stream unless one is given", () => {
    const profile = sampleProfile();
    const a = elec({ readingsProfile: profile });
    const u = toCalcUsage(ok(a), a);
    expect(u.basis).toBe("readings");
    expect(typeof u.sharesFor).toBe("function");
    expect(u.solarExportAnnualKwh).toBeUndefined();
    const b = elec({ readingsProfile: profile, solarExportAnnualKwh: 700, controlledLoadAnnualKwh: 300 });
    const v = toCalcUsage(ok(b), b);
    expect(v).toMatchObject({ solarExportAnnualKwh: 700, controlledLoadAnnualKwh: 300 });
  });
});
