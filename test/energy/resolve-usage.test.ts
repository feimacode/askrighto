/**
 * resolveUsage and toCalcUsage (restructure-energy-compare-usage). Pure: no store.
 * One block per row of the source table in the design: what each usageSource needs, may add and refuses.
 */
import { describe, expect, it } from "vitest";
import { resolveUsage, toCalcUsage, USAGE_SOURCES, type UsageArgs } from "../../src/energy/compare/resolve-usage.js";
import { profileFromUpload } from "../../src/energy/readings/upload.js";
import { generateNem12 } from "../helpers/nem12.js";

type Ctx = { postcode: string; customerType: "RESIDENTIAL" | "BUSINESS" };
const ctx: Ctx = { postcode: "3000", customerType: "RESIDENTIAL" };
const args = (a: Partial<UsageArgs> & Pick<UsageArgs, "usageSource">, fuelType: UsageArgs["fuelType"] = "ELECTRICITY"): UsageArgs => ({ fuelType, ...a });

function ok(a: UsageArgs, c: Ctx = ctx) {
  const r = resolveUsage(a, c);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.result)}`);
  return r.usage;
}
function refused(a: UsageArgs, c: Ctx = ctx): string {
  const r = resolveUsage(a, c);
  if (r.ok) throw new Error("expected a refusal");
  const g = r.result as { found: boolean; reason?: string; message?: string };
  expect(g.found).toBe(false);
  expect(g.reason).toBe("needs_input");
  return g.message ?? "";
}

function profileText(postcode = "3000"): string {
  const r = profileFromUpload(generateNem12({ start: "2026-01-01", days: 3, consumptionKwh: 30, seed: 4 }), postcode, 1_000_000);
  if (!r.ok) throw new Error(r.problem);
  return r.profile;
}
const SPLIT = { peakSharePct: 40, shoulderSharePct: 0, offPeakSharePct: 60 };

describe("usageSource: bill", () => {
  it("scales a bill to a year, in kWh for electricity", () => {
    const u = ok(args({ usageSource: "bill", usage: 900, usageDays: 90 }));
    expect(u).toMatchObject({ level: "bill", unit: "kWh", days: 90 });
    expect(u.annual).toBeCloseTo(3650, 6);
    expect(u.scaledFromBill).toContain("900 kWh over 90 days scaled to a year (x 365/90)");
    expect(u.warnings).toEqual([]);
  });
  it("reads usage in MJ for gas, which ends the gas-given-kWh case", () => {
    const u = ok(args({ usageSource: "bill", usage: 5000, usageDays: 60 }, "GAS"));
    expect(u.unit).toBe("MJ");
    expect(u.annual).toBeCloseTo((5000 * 365) / 60, 6);
    expect(u.scaledFromBill).toContain("5000 MJ");
  });
  it("needs usage and usageDays, naming the one that is missing", () => {
    expect(refused(args({ usageSource: "bill", usageDays: 90 }))).toMatch(/`usage`/);
    expect(refused(args({ usageSource: "bill", usage: 900 }))).toMatch(/`usageDays`/);
  });
  it("may add a split, controlled load, solar and the current plan", () => {
    const u = ok(args({ usageSource: "bill", usage: 900, usageDays: 90, ...SPLIT, currentPlanId: "P1", controlledLoadAnnualKwh: 500, solarExportAnnualKwh: 800 }));
    expect(u.shares).toEqual({ peak: 40, shoulder: 0, offPeak: 60 });
    expect(u.warnings).toEqual([]);
  });
  it("refuses a profile and a household size", () => {
    expect(refused(args({ usageSource: "bill", usage: 900, usageDays: 90, readingsProfile: "x" }))).toBe("`readingsProfile` is not used with usageSource `bill`. Call again without it, or with the source it belongs to.");
    expect(refused(args({ usageSource: "bill", usage: 900, usageDays: 90, householdSize: 2 }))).toMatch(/`householdSize` is not used with usageSource `bill`/);
  });
  it("keeps a current plan or hours layout with no split, and says it was not needed", () => {
    const a = ok(args({ usageSource: "bill", usage: 900, usageDays: 90, currentPlanId: "P1" }));
    expect(a.shares).toBeUndefined();
    expect(a.warnings).toHaveLength(1);
    expect(a.warnings[0]).toMatch(/`currentPlanId` was given without a peak, shoulder and off-peak split, so the current plan's hours were not needed/);
    expect(ok(args({ usageSource: "bill", usage: 900, usageDays: 90, hoursLayoutId: "L1" })).warnings[0]).toMatch(/`hoursLayoutId`/);
  });
  it("checks the split adds up to 100 within half a point, a missing band counting as 0", () => {
    expect(ok(args({ usageSource: "bill", usage: 900, usageDays: 90, peakSharePct: 40, offPeakSharePct: 60 })).shares).toEqual({ peak: 40, shoulder: 0, offPeak: 60 });
    expect(ok(args({ usageSource: "bill", usage: 900, usageDays: 90, peakSharePct: 33.3, shoulderSharePct: 33.3, offPeakSharePct: 33.4 })).shares).toBeDefined();
    expect(refused(args({ usageSource: "bill", usage: 900, usageDays: 90, peakSharePct: 40, shoulderSharePct: 20, offPeakSharePct: 30 }))).toMatch(/add up to 90%, not 100%/);
    expect(refused(args({ usageSource: "bill", usage: 900, usageDays: 90, peakSharePct: 40 }))).toMatch(/add up to 40%/);
  });
});

describe("usageSource: yearly", () => {
  it("takes the figure as a year's use", () => {
    expect(ok(args({ usageSource: "yearly", usage: 4200 }))).toMatchObject({ level: "yearly", unit: "kWh", annual: 4200 });
    expect(ok(args({ usageSource: "yearly", usage: 50_000 }, "GAS"))).toMatchObject({ unit: "MJ", annual: 50_000 });
  });
  it("needs usage", () => {
    expect(refused(args({ usageSource: "yearly" }))).toMatch(/needs `usage`/);
  });
  it("refuses usageDays, a profile and a household size", () => {
    expect(refused(args({ usageSource: "yearly", usage: 4200, usageDays: 365 }))).toMatch(/`usageDays` is not used with usageSource `yearly`/);
    expect(refused(args({ usageSource: "yearly", usage: 4200, readingsProfile: "x" }))).toMatch(/`readingsProfile`/);
    expect(refused(args({ usageSource: "yearly", usage: 4200, householdSize: 2 }))).toMatch(/`householdSize`/);
  });
  it("may add a split and keeps a current plan, warning when there is no split", () => {
    expect(ok(args({ usageSource: "yearly", usage: 4200, ...SPLIT, currentPlanId: "P1" })).warnings).toEqual([]);
    expect(ok(args({ usageSource: "yearly", usage: 4200, currentPlanId: "P1" })).warnings).toHaveLength(1);
  });
  it("refuses an out-of-range electricity figure", () => {
    expect(refused(args({ usageSource: "yearly", usage: 2_000_000 }))).toMatch(/1,000,000 kWh/);
  });
});

describe("usageSource: typical", () => {
  it("needs householdSize, and leaves the figure to the benchmark lookup", () => {
    expect(refused(args({ usageSource: "typical" }))).toMatch(/needs `householdSize`/);
    const u = ok(args({ usageSource: "typical", householdSize: 2 }));
    expect(u).toMatchObject({ level: "typical", unit: "kWh" });
    expect(u.annual).toBeUndefined();
    expect(ok(args({ usageSource: "typical", householdSize: 2 }, "GAS")).unit).toBe("MJ");
  });
  it("refuses everything else in the table, naming the field and the source", () => {
    const extras: Array<Partial<UsageArgs>> = [
      { usage: 4000 }, { usageDays: 90 }, { peakSharePct: 50 }, { shoulderSharePct: 10 }, { offPeakSharePct: 50 },
      { readingsProfile: "x" }, { controlledLoadAnnualKwh: 500 }, { solarExportAnnualKwh: 800 }, { currentPlanId: "P1" }, { hoursLayoutId: "L1" },
    ];
    for (const e of extras) {
      const field = Object.keys(e)[0]!;
      expect(refused(args({ usageSource: "typical", householdSize: 2, ...e }))).toBe(`\`${field}\` is not used with usageSource \`typical\`. Call again without it, or with the source it belongs to.`);
    }
  });
  it("is refused for a business, which has no benchmark", () => {
    expect(refused(args({ usageSource: "typical", householdSize: 2 }), { postcode: "3000", customerType: "BUSINESS" })).toMatch(/no benchmark for a business/);
  });
});

describe("usageSource: readings", () => {
  it("uses the profile's own annual figure and carries its signature check", () => {
    const u = ok(args({ usageSource: "readings", readingsProfile: profileText() }));
    expect(u).toMatchObject({ level: "readings", readingsVerified: true });
    expect(u.annual).toBeCloseTo((30 / 3) * 365, 3);
    expect(u.profile?.daysPresent).toBe(3);
  });
  it("needs the profile", () => {
    expect(refused(args({ usageSource: "readings" }))).toMatch(/needs `readingsProfile`/);
  });
  it("may add controlled load", () => {
    const a = args({ usageSource: "readings", readingsProfile: profileText(), controlledLoadAnnualKwh: 300 });
    expect(toCalcUsage(ok(a), a).controlledLoadAnnualKwh).toBe(300);
  });
  it("refuses usage, usageDays, a split, a household size and solar export, rather than dropping them", () => {
    const p = profileText();
    for (const e of [{ usage: 9999 }, { usageDays: 90 }, { peakSharePct: 50 }, { shoulderSharePct: 10 }, { offPeakSharePct: 50 }, { householdSize: 2 }, { solarExportAnnualKwh: 800 }] as Array<Partial<UsageArgs>>) {
      const field = Object.keys(e)[0]!;
      expect(refused(args({ usageSource: "readings", readingsProfile: p, ...e }))).toContain(`\`${field}\` is not used with usageSource \`readings\``);
    }
  });
  it("is for electricity only", () => {
    expect(refused(args({ usageSource: "readings", readingsProfile: profileText() }, "GAS"))).toMatch(/electricity only/);
  });
  it("refuses a profile that cannot be decoded, or was built for another state", () => {
    expect(refused(args({ usageSource: "readings", readingsProfile: "{not json" }))).toMatch(/could not be used/);
    expect(refused(args({ usageSource: "readings", readingsProfile: profileText("2000") }))).toMatch(/built for a NSW postcode/);
  });
  it("marks a profile whose signature does not check as unverified", () => {
    const p = JSON.parse(profileText());
    p.sig = "tampered";
    expect(ok(args({ usageSource: "readings", readingsProfile: JSON.stringify(p) })).readingsVerified).toBe(false);
  });
  it("keeps a current plan with a warning, since a profile needs no hours", () => {
    expect(ok(args({ usageSource: "readings", readingsProfile: profileText(), currentPlanId: "P1" })).warnings).toHaveLength(1);
  });
});

describe("usageSource: assistant_readings", () => {
  const base = { usageSource: "assistant_readings" as const, usage: 4100, usageDays: 365, ...SPLIT };
  it("scales the summed readings to a year and is its own level", () => {
    const u = ok(args({ ...base, currentPlanId: "P1" }));
    expect(u).toMatchObject({ level: "assistant_readings", days: 365 });
    expect(u.annual).toBeCloseTo(4100, 6);
    expect(u.scaledFromBill).toMatch(/household's own readings over 365 days, summed by the assistant/);
    expect(u.shares).toEqual({ peak: 40, shoulder: 0, offPeak: 60 });
    expect(ok(args({ ...base, hoursLayoutId: "L1" })).level).toBe("assistant_readings");
  });
  it("needs the hours the readings were banded by", () => {
    expect(refused(args(base))).toMatch(/needs `currentPlanId` or `hoursLayoutId`/);
  });
  it("needs the split, usage and usageDays", () => {
    expect(refused(args({ usageSource: "assistant_readings", usage: 4100, usageDays: 365, currentPlanId: "P1" }))).toMatch(/needs the peak, shoulder and off-peak split/);
    expect(refused(args({ ...base, usage: undefined, currentPlanId: "P1" }))).toMatch(/needs `usage`/);
    expect(refused(args({ ...base, usageDays: undefined, currentPlanId: "P1" }))).toMatch(/needs `usageDays`/);
  });
  it("may add controlled load and solar export", () => {
    const a = args({ ...base, currentPlanId: "P1", controlledLoadAnnualKwh: 400, solarExportAnnualKwh: 900 });
    expect(toCalcUsage(ok(a), a)).toMatchObject({ basis: "customer", controlledLoadAnnualKwh: 400, solarExportAnnualKwh: 900 });
  });
  it("refuses a profile and a household size", () => {
    expect(refused(args({ ...base, currentPlanId: "P1", readingsProfile: "x" }))).toMatch(/`readingsProfile` is not used with usageSource `assistant_readings`/);
    expect(refused(args({ ...base, currentPlanId: "P1", householdSize: 2 }))).toMatch(/`householdSize`/);
  });
  it("is for electricity only", () => {
    expect(refused(args({ ...base, currentPlanId: "P1" }, "GAS"))).toMatch(/electricity only/);
  });
});

describe("fuel", () => {
  it("refuses electricity-only fields for gas, naming the field", () => {
    for (const e of [{ peakSharePct: 100 }, { controlledLoadAnnualKwh: 500 }, { solarExportAnnualKwh: 800 }] as Array<Partial<UsageArgs>>) {
      const field = Object.keys(e)[0]!;
      expect(refused(args({ usageSource: "yearly", usage: 50_000, ...e }, "GAS"))).toBe(`\`${field}\` applies to electricity only, not gas. Call again without it.`);
    }
  });
  it("lists every source", () => {
    expect([...USAGE_SOURCES]).toEqual(["readings", "assistant_readings", "bill", "yearly", "typical"]);
  });
});

describe("toCalcUsage", () => {
  it("customer usage carries the split, controlled load and solar", () => {
    const a = args({ usageSource: "yearly", usage: 4000, ...SPLIT, controlledLoadAnnualKwh: 500, solarExportAnnualKwh: 800 });
    expect(toCalcUsage(ok(a), a)).toMatchObject({ fuel: "ELECTRICITY", annualUsage: 4000, basis: "customer", shares: { peak: 40, shoulder: 0, offPeak: 60 }, controlledLoadAnnualKwh: 500, solarExportAnnualKwh: 800 });
  });
  it("readings usage matches each plan's windows and carries the profile's export", () => {
    const text = generateNem12({ start: "2026-01-01", days: 3, consumptionKwh: 30, feedinKwh: 9, seed: 4 });
    const r = profileFromUpload(text, "3000", 1_000_000);
    if (!r.ok) throw new Error(r.problem);
    const a = args({ usageSource: "readings", readingsProfile: r.profile });
    const u = toCalcUsage(ok(a), a);
    expect(u.basis).toBe("readings");
    expect(typeof u.sharesFor).toBe("function");
    expect(u.solarExportAnnualKwh).toBeCloseTo((9 / 3) * 365, 3);
  });
});
