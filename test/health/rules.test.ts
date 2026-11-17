import { describe, expect, it } from "vitest";
import { estimateLhc, estimateRebate, estimateSurcharge, tierFor } from "../../src/health/calc.js";
import { loadRates, overdueRules, proposedAt, ruleAt, validateRates } from "../../src/health/rules.js";
import { fixtureHealth } from "./helpers.js";

const rates = loadRates();
const product = (code: string) => fixtureHealth().products.find((p) => p.code === code)!;

describe("rules by date", () => {
  it("loads the shipped rates and picks the rule by date, across 1 April and 1 July", () => {
    expect(ruleAt(rates.rebate, "2026-05-15")!.thresholds.single[0]).toBe(101000);
    expect(ruleAt(rates.rebate, "2026-08-15")!.thresholds.single[0]).toBe(105000);
    expect(ruleAt(rates.mls, "2026-06-30")!.id).toBe("mls-2025-26");
    expect(ruleAt(rates.mls, "2026-07-01")!.id).toBe("mls-2026-27");
  });
  it("never uses a proposed row", () => {
    expect(ruleAt(rates.rebate, "2027-05-01")).toBeUndefined();
    expect(proposedAt(rates.rebate, "2027-05-01")!.status).toBe("proposed");
  });
  it("rejects overlapping ranges and rows without a source", () => {
    const raw = JSON.parse(JSON.stringify(rates));
    raw.mls.push({ ...raw.mls[0], id: "dup" });
    expect(() => validateRates(raw)).toThrow(/overlap/);
    const raw2 = JSON.parse(JSON.stringify(rates));
    delete raw2.lhc[0].source.readOn;
    expect(() => validateRates(raw2)).toThrow(/source/);
  });
  it("lists rows past their review date", () => {
    expect(overdueRules(rates, "2026-11-17")).toEqual([]);
    expect(overdueRules(rates, "2027-04-02").length).toBeGreaterThan(0);
  });
});

describe("tiers", () => {
  const t = { single: [105000, 123000, 164000], family: [210000, 246000, 328000] };
  it("puts the threshold in the lower tier and adds $1,500 per child after the first", () => {
    expect(tierFor(105000, "single", 0, t, 1500)).toBe("base");
    expect(tierFor(105001, "single", 0, t, 1500)).toBe("tier1");
    expect(tierFor(123001, "single", 0, t, 1500)).toBe("tier2");
    expect(tierFor(164001, "single", 0, t, 1500)).toBe("tier3");
    expect(tierFor(213000, "family", 3, t, 1500)).toBe("base");
    expect(tierFor(213001, "family", 3, t, 1500)).toBe("tier1");
  });
});

describe("rebate", () => {
  it("calculates a premium after rebate from integer cents, rounded once", () => {
    // $200 a month = $2,400 a year; base tier under 65 rebate 24.118% -> $1,821.17
    const e = estimateRebate(rates, product("TST-GOLD"), { ageBand: "under65", incomeTier: "base" }, "2026-08-01");
    expect(e).toMatchObject({ estimated: true, afterBasis: "calculated", premiumBeforeAnnualCents: 240000, premiumAfterAnnualCents: 182117, rebateAnnualCents: 57883 });
  });
  it("shows a premium the file already states for that tier as published", () => {
    const e = estimateRebate(rates, product("TST-COMBO"), { ageBand: "under65", incomeTier: "base" }, "2026-08-01");
    expect(e).toMatchObject({ estimated: true, afterBasis: "published", premiumAfterAnnualCents: 13660 * 12 });
  });
  it("uses the age band and tier percentages, and tier 3 gets none", () => {
    expect(estimateRebate(rates, product("TST-GOLD"), { ageBand: "age70plus", incomeTier: "base" }, "2026-08-01")).toMatchObject({ rebatePercentMilli: 32158 });
    expect(estimateRebate(rates, product("TST-GOLD"), { ageBand: "under65", incomeTier: "tier3" }, "2026-08-01")).toMatchObject({ premiumAfterAnnualCents: 240000 });
  });
  it("says the basis is unclear when the file does not say, and when rates are out of range, naming a proposed change without using it", () => {
    expect(estimateRebate(rates, product("TST-NOBASIS"), { ageBand: "under65", incomeTier: "base" }, "2026-08-01")).toMatchObject({ estimated: false, reason: "rebate_basis_unclear" });
    const out = estimateRebate(rates, product("TST-GOLD"), { ageBand: "age70plus", incomeTier: "base" }, "2027-05-01");
    expect(out).toMatchObject({ estimated: false, reason: "rules_out_of_range" });
    expect((out as { proposed?: unknown }).proposed).toBeDefined();
    expect(estimateRebate(rates, product("TST-GOLD"), { ageBand: "under65", incomeTier: "base" }, "2020-01-01")).toMatchObject({ reason: "rules_out_of_range" });
  });
  it("needs a tier or an income with a household", () => {
    expect(estimateRebate(rates, product("TST-GOLD"), { ageBand: "under65" }, "2026-08-01")).toMatchObject({ reason: "needs_input" });
  });
});

describe("surcharge and loading", () => {
  it("applies the tier rate to income in cents", () => {
    // $120,000 single, 2026-27: tier 1, 1% -> $1,200
    expect(estimateSurcharge(rates, { income: 120000, household: "single" }, "2026-08-01")).toMatchObject({ tier: "tier1", ratePercentMilli: 1000, surchargeCents: 120000 });
    expect(estimateSurcharge(rates, { income: 100000, household: "single" }, "2026-08-01")).toMatchObject({ tier: "base", surchargeCents: 0 });
    expect(estimateSurcharge(rates, { income: 170000, household: "single" }, "2026-08-01")).toMatchObject({ ratePercentMilli: 1500, surchargeCents: 255000 });
    expect(estimateSurcharge(rates, { income: 120000, household: "single" }, "2030-01-01")).toMatchObject({ estimated: false, reason: "rules_out_of_range" });
  });
  it("calculates the loading, caps it at 70, removes it after ten years, and refuses unusual cases", () => {
    expect(estimateLhc(rates, { ageAtFirstHospitalCover: 40 }, "2026-08-01")).toMatchObject({ loadingPercent: 20 });
    expect(estimateLhc(rates, { ageAtFirstHospitalCover: 25 }, "2026-08-01")).toMatchObject({ loadingPercent: 0 });
    expect(estimateLhc(rates, { ageAtFirstHospitalCover: 80 }, "2026-08-01")).toMatchObject({ loadingPercent: 70 });
    expect(estimateLhc(rates, { ageAtFirstHospitalCover: 40, yearsOfContinuousCover: 10 }, "2026-08-01")).toMatchObject({ loadingPercent: 0, removed: true });
    expect(estimateLhc(rates, { ageAtFirstHospitalCover: 40, unusualCircumstances: true }, "2026-08-01")).toMatchObject({ estimated: false, reason: "base_day_unclear" });
  });
});
