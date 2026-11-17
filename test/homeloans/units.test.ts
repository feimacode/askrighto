import { describe, expect, it } from "vitest";
import { calculate } from "../../src/homeloans/calc.js";
import { isoMonths, normaliseProduct, rateToPct, readListItem } from "../../src/homeloans/normalise.js";
import { selectRates } from "../../src/homeloans/select.js";
import { legalMarkerProblem, assertHomeLoanPublicGuard } from "../../src/homeloans/guard.js";
import { HOME_LOAN_INSTRUCTIONS } from "../../src/homeloans/instructions.js";
import { HOME_LOAN_NOTICE, NOTICE_NOT_ADVICE } from "../../src/homeloans/notices.js";
import { HOME_LOAN_TOOLS } from "../../src/tools/home-loan-tools.js";
import { product, rate } from "./helpers.js";

const norm = (id: string, over: Record<string, any> = {}) => {
  const d = product(id, over);
  return normaliseProduct("testbank", readListItem(d)!, d, new Date("2026-11-17T00:00:00Z"));
};

describe("normalise", () => {
  it("keeps the published rate string and converts once to percent", () => {
    const p = norm("a");
    expect(p.rates[0]).toMatchObject({ rate: "0.0599", ratePct: 5.99, comparisonRate: "0.0612", comparisonRatePct: 6.12 });
    expect(p.understood).toBe(true);
  });
  it("never invents a comparison rate", () => {
    const p = norm("a", { lendingRates: [rate({ comparisonRate: null })] });
    expect(p.rates[0]!.comparisonRate).toBeUndefined();
    expect(p.rates[0]!.comparisonRatePct).toBeUndefined();
  });
  it("rejects a rate that is not a fraction rather than guessing", () => {
    expect(rateToPct("5.99")).toBeUndefined();
    const p = norm("a", { lendingRates: [rate({ rate: "5.99" })] });
    expect(p.understood).toBe(false);
    expect(p.notUnderstood).toContain("rate:not_a_fraction");
  });
  it("reads fixed terms from ISO durations and flags unreadable ones", () => {
    expect(isoMonths("P3Y")).toBe(36);
    expect(isoMonths("P18M")).toBe(18);
    expect(isoMonths("P1Y6M")).toBe(18);
    expect(isoMonths("3 years")).toBeUndefined();
    const ok = norm("a", { lendingRates: [rate({ lendingRateType: "FIXED", additionalValue: "P2Y" })] });
    expect(ok.rates[0]!.fixedTermMonths).toBe(24);
    const bad = norm("b", { lendingRates: [rate({ lendingRateType: "FIXED", additionalValue: "two years" })] });
    expect(bad.understood).toBe(false);
    expect(bad.notUnderstood).toContain("fixedRate:no_term");
  });
  it("keeps and flags unknown rate types, tier units and possible construction loans", () => {
    expect(norm("a", { lendingRates: [rate({ lendingRateType: "MYSTERY" })] }).notUnderstood).toContain("rateType:MYSTERY");
    expect(norm("a", { lendingRates: [rate({ tiers: [{ name: "x", unitOfMeasure: "FURLONG", minimumValue: "1" }] })] }).notUnderstood).toContain("tier:unknown_unit");
    expect(norm("a", { name: "Construction Loan" }).notUnderstood).toContain("category:possible_construction_or_reverse");
    expect(norm("a", { lendingRates: [] }).notUnderstood).toContain("rates:none");
  });
  it("accepts tier bounds sent as JSON numbers", () => {
    const n = norm("gs", { lendingRates: [rate({ tiers: [{ name: "LVR", unitOfMeasure: "PERCENT", minimumValue: 0, maximumValue: 0.7001 }] })] });
    expect(n.notUnderstood).not.toContain("tier:unknown_unit");
    expect(n.rates[0]!.tiers[0]).toMatchObject({ unit: "PERCENT_LVR", min: "0", max: "0.7001" });
  });
  it("treats an absent purpose or repayment type (older versions) as applying to all", () => {
    const p = norm("a", { lendingRates: [rate({ loanPurpose: undefined, repaymentType: undefined })] });
    expect(p.rates[0]).toMatchObject({ purpose: "UNCONSTRAINED", repayment: "UNCONSTRAINED" });
  });
  it("is stable under key order", () => {
    expect(norm("a").detailHash).toBe(norm("a").detailHash);
  });
});

describe("select", () => {
  const p = norm("a", {
    lendingRates: [
      rate({ rate: "0.0599", tiers: [{ name: "to 80", unitOfMeasure: "PERCENT", minimumValue: "0", maximumValue: "0.8" }] }),
      rate({ rate: "0.0649", tiers: [{ name: "80 to 95", unitOfMeasure: "PERCENT", minimumValue: "0.8", maximumValue: "0.95" }] }),
      rate({ lendingRateType: "FIXED", additionalValue: "P3Y", rate: "0.0569", loanPurpose: "INVESTMENT" }),
    ],
  });
  it("picks the tier covering the LVR given", () => {
    expect(selectRates(p, { purpose: "OWNER_OCCUPIED", lvrPercent: 70 }).rates.map((r) => r.rate)).toEqual(["0.0599"]);
    expect(selectRates(p, { purpose: "OWNER_OCCUPIED", lvrPercent: 90 }).rates.map((r) => r.rate)).toEqual(["0.0649"]);
  });
  it("reports no published rate for an LVR outside every tier instead of dropping silently", () => {
    const s = selectRates(p, { purpose: "OWNER_OCCUPIED", lvrPercent: 98 });
    expect(s.rates).toEqual([]);
    expect(s.noRateForLvr).toBe(true);
  });
  it("matches fixed terms exactly and respects purpose", () => {
    expect(selectRates(p, { kind: "fixed", fixedTermYears: 3, purpose: "INVESTMENT" }).rates).toHaveLength(1);
    expect(selectRates(p, { kind: "fixed", fixedTermYears: 3, purpose: "OWNER_OCCUPIED" }).rates).toHaveLength(0);
    expect(selectRates(p, { kind: "fixed", fixedTermYears: 5, purpose: "INVESTMENT" }).rates).toHaveLength(0);
  });
});

describe("calculator (integer cents)", () => {
  const base = { termYears: 30, frequency: "monthly", repayment: "PRINCIPAL_AND_INTEREST" } as const;
  it("matches the textbook payment for $500,000 at 6% over 30 years", () => {
    const r = calculate({ ...base, principalCents: 500_000_00, annualRatePct: 6 });
    expect(r.scheduledPaymentCents).toBe(299_775); // $2,997.75
    expect(r.endBalanceCents).toBe(0);
    expect(r.periodsRun).toBeLessThanOrEqual(360);
    // Total paid is within a few dollars of 360 payments (the last payment is trimmed).
    expect(Math.abs(r.totalPaidCents - 360 * 299_775)).toBeLessThan(1000);
    expect(r.totalPaidCents - r.totalInterestCents).toBe(500_000_00);
  });
  it("matches $600,000 at 6.5% over 25 years", () => {
    expect(calculate({ ...base, termYears: 25, principalCents: 600_000_00, annualRatePct: 6.5 }).scheduledPaymentCents).toBe(405_124); // $4,051.24, checked against an independent decimal calculation
  });
  it("interest-only pays interest and leaves the principal", () => {
    const r = calculate({ ...base, repayment: "INTEREST_ONLY", principalCents: 600_000_00, annualRatePct: 6 });
    expect(r.scheduledPaymentCents).toBe(300_000);
    expect(r.endBalanceCents).toBe(600_000_00);
    expect(r.totalInterestCents).toBe(300_000 * 360);
  });
  it("zero rate divides evenly", () => {
    expect(calculate({ ...base, termYears: 10, principalCents: 120_000_00, annualRatePct: 0 }).scheduledPaymentCents).toBe(100_000);
  });
  it("extra repayments and an offset shorten the loan and save interest, never negative", () => {
    const plain = calculate({ ...base, principalCents: 500_000_00, annualRatePct: 6 });
    const extra = calculate({ ...base, principalCents: 500_000_00, annualRatePct: 6, extraPerPeriodCents: 30_000 });
    const off = calculate({ ...base, principalCents: 500_000_00, annualRatePct: 6, offsetCents: 50_000_00 });
    for (const r of [extra, off]) {
      expect(r.interestSavedCents!).toBeGreaterThan(0);
      expect(r.periodsSaved!).toBeGreaterThan(0);
      expect(r.endBalanceCents).toBe(0);
      expect(r.totalInterestCents).toBeLessThan(plain.totalInterestCents);
    }
    expect(plain.interestSavedCents).toBeUndefined();
  });
  it("covers only the fixed window when asked", () => {
    const r = calculate({ ...base, principalCents: 500_000_00, annualRatePct: 6, windowMonths: 36 });
    expect(r.periodsRun).toBe(36);
    expect(r.endBalanceCents).toBeGreaterThan(0);
    expect(r.endBalanceCents).toBeLessThan(500_000_00);
  });
  it("supports fortnightly and weekly periods", () => {
    expect(calculate({ ...base, frequency: "fortnightly", principalCents: 500_000_00, annualRatePct: 6 }).periodsPerYear).toBe(26);
    expect(calculate({ ...base, frequency: "weekly", principalCents: 500_000_00, annualRatePct: 6 }).periodsPerYear).toBe(52);
  });
  it("rejects absurd inputs with a message", () => {
    expect(() => calculate({ ...base, principalCents: 10, annualRatePct: 6 })).toThrow(/loan amount/);
    expect(() => calculate({ ...base, termYears: 80, principalCents: 500_000_00, annualRatePct: 6 })).toThrow(/term/);
    expect(() => calculate({ ...base, principalCents: 500_000_00, annualRatePct: 60 })).toThrow(/rate/);
  });
  it("is deterministic", () => {
    const i = { ...base, principalCents: 432_100_50, annualRatePct: 5.87 } as const;
    expect(calculate(i)).toEqual(calculate(i));
  });
});

describe("wording and guards", () => {
  const BANNED = /\b(best|recommended?|cheapest|you should|approved|eligible)\b/i;
  it("tool descriptions and instructions never recommend or promise approval", () => {
    for (const t of HOME_LOAN_TOOLS) {
      // "recommend" appears only in negations such as "does not recommend".
      const text = t.description.replace(/does not recommend|never recommend|Picks no winner/gi, "");
      expect(text, t.name).not.toMatch(BANNED);
    }
    expect(HOME_LOAN_INSTRUCTIONS.replace(/Never say[^.]*\./i, "").replace(/Do not assess[^.]*\./i, "")).not.toMatch(/\b(you should)\b/i);
  });
  it("the fixed notice says it is not advice", () => {
    expect(HOME_LOAN_NOTICE).toContain(NOTICE_NOT_ADVICE);
  });
  it("every tool is read-only and flat (checked at registration)", () => {
    for (const t of HOME_LOAN_TOOLS) expect(t.readOnlyHint).toBe(true);
  });
  it("legal marker needs reviewer, date and scope", () => {
    expect(legalMarkerProblem("Reviewer: A Lawyer\nDate: 2027-01-05\nScope: listing, comparison")).toBeUndefined();
    expect(legalMarkerProblem("Reviewer: A\nDate: soon\nScope: x")).toMatch(/Date/);
    expect(legalMarkerProblem("Date: 2027-01-05\nScope: x")).toMatch(/Reviewer/);
  });
  it("public home-loans in production needs the marker file; development does not", () => {
    expect(() => assertHomeLoanPublicGuard(["home-loans"], { ASKRIGHTO_ENV: "production", ASKRIGHTO_HOME_LOAN_LEGAL_FILE: "/nonexistent/x.md" })).toThrow(/legal view/);
    expect(() => assertHomeLoanPublicGuard(["home-loans"], { ASKRIGHTO_ENV: "development" })).not.toThrow();
    expect(() => assertHomeLoanPublicGuard(["energy"], { ASKRIGHTO_ENV: "production" })).not.toThrow();
  });
});

describe("routes and docs", () => {
  it("home loan tools exist on the internal set and not on the public set", async () => {
    const { routeSet } = await import("../../src/verticals.js");
    const { ALL_VERTICALS } = await import("../../src/server/route.js");
    const names = (ids: string[]) => routeSet(ALL_VERTICALS, ids).tools.map((t) => t.name);
    expect(names(["energy"]).filter((n) => /home_loan/.test(n))).toEqual([]);
    expect(names(["energy", "home-loans"])).toEqual(expect.arrayContaining(HOME_LOAN_TOOLS.map((t) => t.name)));
  });
  it("registers cleanly (names, hints and flat schemas pass validation)", async () => {
    const { validateToolDefinition } = await import("../../src/core/define-tool.js");
    for (const t of HOME_LOAN_TOOLS) expect(() => validateToolDefinition(t)).not.toThrow();
  });
  it("ASKRIGHTO_HOME_LOAN_TOOLS limits the vertical's tools and rejects unknown names", async () => {
    const { enabledHomeLoanTools } = await import("../../src/homeloans/vertical.js");
    expect(enabledHomeLoanTools({ ASKRIGHTO_HOME_LOAN_TOOLS: "search_home_loans,get_home_loan" } as any).map((t) => t.name)).toEqual(["search_home_loans", "get_home_loan"]);
    expect(() => enabledHomeLoanTools({ ASKRIGHTO_HOME_LOAN_TOOLS: "nope_tool" } as any)).toThrow(/unknown/);
    expect(enabledHomeLoanTools({} as any)).toHaveLength(HOME_LOAN_TOOLS.length);
  });
  it("every tool named in the prompt set exists", async () => {
    const { readFileSync } = await import("node:fs");
    const md = readFileSync("docs/home-loan-evaluation/prompts.md", "utf8");
    const known = new Set(HOME_LOAN_TOOLS.map((t) => t.name));
    let rows = 0;
    for (const line of md.split("\n").filter((l) => /^\| H\d\d /.test(l))) {
      rows++;
      const tools = line.split("|")[3]!.trim();
      if (tools === "(none)") continue;
      for (const n of tools.split(",").map((x) => x.trim())) expect(known.has(n), `${line.slice(0, 8)}: ${n}`).toBe(true);
    }
    expect(rows).toBe(24);
  });
  it("the legal marker is not committed until a view exists", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("docs/legal/home-loans-view.md")).toBe(false);
  });
});

describe("list version negotiation", () => {
  it("steps down from x-v 5 to 4 when a lender answers 406, and remembers it", async () => {
    const { BankingClient } = await import("../../src/homeloans/client.js");
    const { RetailerLimiter } = await import("../../src/cdr/limiter.js");
    const { product, startMockLenders } = await import("./helpers.js");
    const mock = await startMockLenders({ v4only: [{ detail: product("X1") }], modern: [{ detail: product("Y1") }] });
    try {
      const c = new BankingClient({ limiter: new RetailerLimiter({ rps: 500, maxInFlight: 4 }), backoffMs: 1 });
      const l = (slug: string) => ({ slug, brandName: slug, baseUri: `${mock.url}/${slug}`, active: true });
      expect(await c.listProducts(l("v4only"))).toHaveLength(1);
      expect(await c.listProducts(l("modern"))).toHaveLength(1);
      await c.listProducts(l("v4only"));
      const used = mock.log.filter((x) => x.slug === "v4only").map((x) => x.v);
      expect(used).toEqual(["5", "4", "4"]);
      expect(mock.log.filter((x) => x.slug === "modern").map((x) => x.v)).toEqual(["5"]);
    } finally {
      await mock.close();
    }
  });
});
