import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bannedInHealth, HEALTH_NOTICE } from "../../src/health/notice.js";
import { setHealthRuntime } from "../../src/health/index.js";
import { HEALTH_TOOLS } from "../../src/tools/health-tools.js";
import { metricsText, resetMetrics } from "../../src/core/metrics.js";
import { call, connectHealth, installHealth } from "./helpers.js";

beforeEach(() => installHealth());
afterEach(() => {
  setHealthRuntime(undefined);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const GOLD = "tst-gold";
const BRONZE = "tst-bronze";
const COMBO = "tst-combo";
const COUPLE = "tst-couple";
const EXTRAS = "tst-extras";

describe("health cover tools", () => {
  it("are read-only, on the internal route only, with no free-text condition input", async () => {
    const internal = (await (await connectHealth()).listTools()).tools;
    for (const t of HEALTH_TOOLS) expect(internal.map((x) => x.name)).toContain(t.name);
    for (const t of internal) expect(t.annotations?.readOnlyHint).toBe(true);
    const pub = (await (await connectHealth(["energy"], "public")).listTools()).tools.map((t) => t.name);
    expect(pub.some((n) => n.includes("health"))).toBe(false);
    for (const t of HEALTH_TOOLS)
      for (const key of Object.keys(t.inputSchema.shape))
        expect(key).not.toMatch(/condition|diagnos|medication|treatment|name|member|dob|birth/i);
    expect(z.toJSONSchema(HEALTH_TOOLS[0]!.inputSchema)).toBeTruthy();
  });

  it("builds its Inkview components without validation errors", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = await connectHealth();
    await call(c, "search_health_cover_products", { state: "VIC" });
    await call(c, "compare_health_cover_products", { productIds: [GOLD, BRONZE] });
    expect(err.mock.calls.flat().join(" ")).not.toMatch(/Inkview component skipped/);
    err.mockRestore();
  });

  it("searches with the stated cover per category, orders only by the chosen sort, and states the file date and coverage", async () => {
    const c = await connectHealth();
    const { data, text } = await call(c, "search_health_cover_products", {
      state: "VIC",
      household: "single",
      requiredCategories: ["PregnancyBirth"],
    });
    expect(data.found).toBe(true);
    // Bronze says not covered, so it is left out; combo (180) is below gold (200).
    expect(data.data.products.map((p: { productId: string }) => p.productId)).toEqual([COMBO, GOLD]);
    expect(data.data.categoryStates[0]).toEqual({ PregnancyBirth: "covered" });
    expect(data.asOf).toMatch(/^2026-11-03/);
    expect(data.source.attribution).toMatch(/CC BY 3\.0 AU/);
    expect(data.data.coverage).toMatch(/not necessarily every fund or the whole market/);
    expect(text).toContain(HEALTH_NOTICE);
    expect(text).toMatch(/Confirm price and cover with the insurer/);
    expect(bannedInHealth(text)).toEqual([]);
    const byExcess = await call(c, "search_health_cover_products", { state: "VIC", coverType: "hospital", sort: "excess_asc" });
    expect(byExcess.data.data.products.map((p: { productId: string }) => p.productId)).toEqual([GOLD, BRONZE]);
  });

  it("does not count a product with no published premium as under a premium cap, and says how many", async () => {
    const c = await connectHealth();
    const { data } = await call(c, "search_health_cover_products", { state: "VIC", maxMonthlyPremium: 150 });
    expect(data.data.products.map((p: { productId: string }) => p.productId)).toEqual([BRONZE]);
    expect(data.data.matchesWithoutPublishedPremium).toBeGreaterThanOrEqual(1);
  });

  it("asks for a real category name instead of accepting a condition", async () => {
    const c = await connectHealth();
    const { data } = await call(c, "search_health_cover_products", { requiredCategories: ["my knee surgery"] });
    expect(data).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("gets and compares products, and refuses five", async () => {
    const c = await connectHealth();
    const g = await call(c, "get_health_cover_product", { productId: GOLD });
    expect(g.data.data.categories.length).toBe(3);
    expect(g.text).toMatch(/Waiting periods: PreExisting: 12 months; PregnancyBirth: 12 months/);
    const nb = await call(c, "get_health_cover_product", { productId: COUPLE });
    expect(nb.text).toMatch(/Excess: not published/);
    expect((await call(c, "get_health_cover_product", { productId: "zzz" })).data).toMatchObject({ found: false, reason: "not_in_dataset" });
    const cmp = await call(c, "compare_health_cover_products", { productIds: [GOLD, BRONZE] });
    expect(cmp.data.found).toBe(true);
    expect(cmp.text).toMatch(/Categories not covered/);
    expect(bannedInHealth(cmp.text)).toEqual([]);
    const five = await call(c, "compare_health_cover_products", { productIds: [GOLD, BRONZE, COMBO, COUPLE, GOLD] });
    expect(five.data).toMatchObject({ found: false });
  });

  it("estimates a premium after rebate, labelled calculated, with rules source and effective dates", async () => {
    const c = await connectHealth();
    const { data, text } = await call(c, "estimate_premium_after_rebate", {
      productId: GOLD,
      ageBand: "under65",
      incomeTier: "base",
      asAt: "2026-08-01",
    });
    expect(data.found).toBe(true);
    expect(data.data.premiumAfterRebateAnnual).toBe("$1,821.17");
    expect(data.data.basis).toBe("calculated");
    expect(text).toMatch(/calculated/);
    expect(text).toMatch(/insurer's quote and the ATO's own calculator govern/);
    expect(data.source.url).toMatch(/ato\.gov\.au/);
    expect(data.asOf).toMatch(/^2026-06-22/);
    expect(bannedInHealth(text)).toEqual([]);
    const pub = await call(c, "estimate_premium_after_rebate", { productId: COMBO, ageBand: "under65", incomeTier: "base", asAt: "2026-08-01" });
    expect(pub.data.data.basis).toBe("calculated");
    expect(pub.data.data.premiumBeforeRebateAnnual).toBe("$2,160.00");
  });

  it("will not estimate when the basis is unclear, the date is outside the rules, or a change is only proposed", async () => {
    const c = await connectHealth();
    const a = await call(c, "estimate_premium_after_rebate", { productId: EXTRAS, ageBand: "under65", incomeTier: "base", asAt: "2026-08-01" });
    expect(a.data).toMatchObject({ found: false, details: { calcReason: "rebate_basis_unclear" } });
    const b = await call(c, "estimate_premium_after_rebate", { productId: GOLD, ageBand: "age70plus", incomeTier: "base", asAt: "2027-05-01" });
    expect(b.data).toMatchObject({ found: false, details: { calcReason: "rules_out_of_range" } });
    expect(JSON.stringify(b.data)).toMatch(/proposed from that date and is not law/);
    expect(JSON.stringify(b.data)).not.toMatch(/24\.118/);
  });

  it("shows the surcharge and the premium after rebate with no directive, and keeps the income out of metrics", async () => {
    resetMetrics();
    const c = await connectHealth();
    const { data, text } = await call(c, "check_levy_surcharge_breakeven", {
      productId: GOLD,
      income: 120000,
      household: "single",
      ageBand: "under65",
      asAt: "2026-08-01",
    });
    expect(data.found).toBe(true);
    expect(data.data.surchargeAnnual).toBe("$1,200.00");
    // tier 1 rebate 16.079% of $2,400 -> $2,014.10
    expect(data.data.premiumAfterRebateAnnual).toBe("$2,014.10");
    expect(data.data.lowerOf).toMatch(/surcharge is the lower/);
    expect(text).toMatch(/not a view on whether to hold cover/);
    expect(bannedInHealth(text)).toEqual([]);
    expect(metricsText()).not.toMatch(/120000|120,000/);
    const extras = await call(c, "check_levy_surcharge_breakeven", { productId: EXTRAS, income: 120000, household: "single", ageBand: "under65" });
    expect(extras.data).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("estimates the loading and flags unusual cases, and lists rules with a proposed change marked not law", async () => {
    const c = await connectHealth();
    const l = await call(c, "estimate_lifetime_health_cover_loading", { ageAtFirstHospitalCover: 40, asAt: "2026-08-01" });
    expect(l.data.data.loadingPercent).toBe(20);
    expect(l.text).toMatch(/hospital part of a premium/);
    const u = await call(c, "estimate_lifetime_health_cover_loading", { ageAtFirstHospitalCover: 40, unusualCircumstances: true });
    expect(u.data).toMatchObject({ found: false, details: { calcReason: "base_day_unclear" } });
    const r = await call(c, "get_health_cover_rules", { asAt: "2026-08-01" });
    expect(r.data.data.rebate.thresholds.single).toEqual([105000, 123000, 164000]);
    expect(r.text).toMatch(/PROPOSED, NOT LAW/);
    expect(r.text).toMatch(/No figure is calculated from it/);
    expect(bannedInHealth(r.text)).toEqual([]);
  });

  it("warns when the file predates the last 1 April or 1 July", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T00:00:00Z"));
    const c = await connectHealth();
    expect((await call(c, "get_health_cover_product", { productId: GOLD })).data.warnings ?? []).not.toContainEqual(expect.stringMatching(/premiums often change/));
    vi.setSystemTime(new Date("2027-04-10T00:00:00Z"));
    const w = await call(c, "get_health_cover_product", { productId: GOLD });
    expect(w.data.warnings?.join(" ")).toMatch(/before 2027-04-01, when premiums often change/);
  });

  it("answers data_unavailable with no runtime and counts outcomes only", async () => {
    resetMetrics();
    const c = await connectHealth();
    await call(c, "search_health_cover_products", { state: "VIC" });
    expect(metricsText()).toMatch(/tool="search_health_cover_products",outcome="results"/);
    setHealthRuntime(undefined);
    expect((await call(c, "get_health_cover_product", { productId: GOLD })).data.reason).toBe("data_unavailable");
    expect((await call(c, "get_health_cover_rules", {})).data.reason).toBe("data_unavailable");
  });
});
