/**
 * Sync, store and tools against a real PostgreSQL and a mock lender server. Set TEST_DATABASE_URL to run
 * (see docs/local-database.md). Fixtures are synthetic: no live lender payload has been read yet.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RetailerLimiter } from "../../src/cdr/limiter.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { BankingClient } from "../../src/homeloans/client.js";
import { parseExclusions, setHomeLoanRuntime } from "../../src/homeloans/index.js";
import { buildReport } from "../../src/homeloans/report.js";
import { readAll, setCashRate } from "../../src/homeloans/store.js";
import { runHomeLoanSync } from "../../src/homeloans/sync.js";
import type { Lender } from "../../src/homeloans/types.js";
import {
  calculateHomeLoanRepayments, compareHomeLoans, getHomeLoan, getHomeLoanReferenceRates, searchHomeLoans,
} from "../../src/tools/home-loan-tools.js";
import { product, rate, startMockLenders, type MockLenders } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
let mock: MockLenders;
let lenders: Lender[];

const client = () => new BankingClient({ limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }), backoffMs: 1 });
const sync = (now?: Date, recheckDays = 7) =>
  runHomeLoanSync({ db, client: client(), lenders, ...(now ? { now: () => now } : {}), recheckDays });
const detailCalls = () => mock.log.filter((l) => /products\/[^/?]+$/.test(l.path)).length;
const tool = async (t: { handler: (a: any) => any }, args: Record<string, unknown>) => {
  setHomeLoanRuntime({ data: () => readAll(db), excluded: new Set() });
  return t.handler(args) as Promise<any>;
};

beforeAll(async () => {
  if (!URL) return;
  db = createDb({ url: URL, schema, poolMax: 5 });
  await migrate(db);
  mock = await startMockLenders({});
  lenders = ["alpha", "beta"].map((slug) => ({ slug, brandName: slug.toUpperCase(), baseUri: `${mock.url}/${slug}`, active: true }));
});
afterAll(async () => {
  setHomeLoanRuntime(undefined);
  if (!URL) return;
  await mock.close();
  const admin = new pg.Pool({ connectionString: URL });
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  await db.close();
});

d("home loan sync", () => {
  beforeEach(async () => {
    await db.pool.query("TRUNCATE home_loan_changes, home_loan_products, home_loan_lenders, home_loan_sync_runs, reference_rates RESTART IDENTITY CASCADE");
    mock.log.length = 0;
    mock.fail.clear();
    mock.state.alpha = [
      { detail: product("A1") },
      { detail: product("A2", { name: "Investor Fixed", lendingRates: [rate({ lendingRateType: "FIXED", additionalValue: "P3Y", rate: "0.0559", loanPurpose: "INVESTMENT" })] }) },
      { detail: product("A3", { productCategory: "PERS_LOANS" }) },
    ];
    mock.state.beta = [
      { detail: product("B1", { brandName: "Beta", lendingRates: [rate({ rate: "0.0579", comparisonRate: undefined })], features: [] }) },
      { detail: product("B2", { name: "Weird", lendingRates: [rate({ lendingRateType: "MYSTERY" })] }) },
    ];
  });

  it("loads only residential mortgages, flags the unreadable, and reports", async () => {
    const r = (await sync())!;
    expect(r.ok).toBe(true);
    expect(r.products.added).toBe(4);
    expect(r.productsPerLender).toEqual({ alpha: 2, beta: 2 });
    expect(r.notUnderstood.byReason["rateType:MYSTERY"]).toBe(1);
    expect(mock.log.some((l) => l.path.includes("product-category=RESIDENTIAL_MORTGAGES"))).toBe(true);
    expect(mock.log.every((l) => l.v === (/products\/[^/?]+$/.test(l.path) ? "7" : "4"))).toBe(true);
  });

  it("makes no detail call for unchanged products, refetches a changed one, removes a withdrawn one", async () => {
    await sync(new Date("2026-11-17T00:00:00Z"), 1000);
    expect(detailCalls()).toBe(4);
    mock.log.length = 0;
    await sync(new Date("2026-11-18T00:00:00Z"), 1000);
    expect(detailCalls()).toBe(1 + 1); // quota is 1 per lender with recheckDays 1000
    mock.log.length = 0;
    mock.state.alpha![0]!.detail = product("A1", { lastUpdated: "2026-11-19T00:00:00Z", lendingRates: [rate({ rate: "0.0549" })] });
    mock.state.beta = mock.state.beta!.slice(0, 1);
    const r = (await sync(new Date("2026-11-19T01:00:00Z"), 1000))!;
    expect(r.products.changed).toBe(1);
    expect(r.products.removed).toBe(1);
    const data = await readAll(db);
    expect(data.products.find((p) => p.productId === "A1")!.rates[0]!.rate).toBe("0.0549");
    expect(data.products.some((p) => p.productId === "B2")).toBe(false);
  });

  it("keeps a failing lender's products with their old verified time", async () => {
    await sync(new Date("2026-11-10T00:00:00Z"));
    mock.fail.add("beta");
    const r = (await sync(new Date("2026-11-17T00:00:00Z")))!;
    expect(r.ok).toBe(false);
    const data = await readAll(db);
    const b = data.products.filter((p) => p.lenderSlug === "beta");
    expect(b).toHaveLength(2);
    expect(b.every((p) => p.verifiedAt.startsWith("2026-11-10"))).toBe(true);
    expect(data.lenders.find((l) => l.slug === "beta")).toMatchObject({ lastSyncOk: false });
    expect(buildReport(data, new Date("2026-11-17T00:00:00Z")).lenders.failing).toEqual(["beta"]);
  });

  it("lets only one runner sync at a time", async () => {
    const [a, b] = await Promise.all([sync(), sync()]);
    expect([a, b].filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect((await readAll(db)).products).toHaveLength(4);
  });
});

d("home loan tools", () => {
  beforeAll(async () => {
    await db.pool.query("TRUNCATE home_loan_changes, home_loan_products, home_loan_lenders, home_loan_sync_runs, reference_rates RESTART IDENTITY CASCADE");
    mock.fail.clear();
    mock.state.alpha = [
      {
        detail: product("A1", {
          lendingRates: [
            rate({ rate: "0.0599", tiers: [{ name: "to 80", unitOfMeasure: "PERCENT", minimumValue: "0", maximumValue: "0.8" }] }),
            rate({ rate: "0.0629", tiers: [{ name: "80 to 95", unitOfMeasure: "PERCENT", minimumValue: "0.8", maximumValue: "0.95" }] }),
            rate({ rate: "0.0689", loanPurpose: "INVESTMENT" }),
          ],
        }),
      },
      { detail: product("A2", { name: "Fixed", lendingRates: [rate({ lendingRateType: "FIXED", additionalValue: "P2Y", rate: "0.0539" })], features: [] }) },
      { detail: product("A4", { name: "Negotiated", isTailored: true, lendingRates: [rate({ rate: "0.0519" })] }) },
    ];
    mock.state.beta = [
      { detail: product("B1", { brandName: "Beta", lendingRates: [rate({ rate: "0.0579", comparisonRate: undefined })], features: [] }) },
      { detail: product("B2", { name: "Weird", lendingRates: [rate({ lendingRateType: "MYSTERY" })] }) },
    ];
    await sync(new Date());
    await setCashRate(db.pool, { effectiveDate: "2026-11-04", valuePct: 3.6, sourceUrl: "https://www.rba.gov.au/statistics/cash-rate/" }, new Date());
  });

  it("search lists in lender order with no ranking unless asked, and counts what it left out", async () => {
    const r = await tool(searchHomeLoans, { purpose: "OWNER_OCCUPIED", repayment: "PRINCIPAL_AND_INTEREST" });
    expect(r.found).toBe(true);
    expect(r.data.sortedBy).toMatch(/no ranking/);
    expect(r.data.products.map((p: any) => p.productId)).toEqual(["B1", "A2", "A1", "A4"]);
    expect(r.data.coverage).toMatchObject({ lendersInList: 2, excludedNotUnderstood: 1 });
    expect(r.data.coverage.wording).toMatch(/not every lender/);
    expect(r.data.notice).toMatch(/not credit advice/);
    expect(r.source.url).toBeTruthy();
    expect(new Date(r.asOf).getTime()).toBeGreaterThan(0);
  });

  it("sorts by published rate only when asked, and says a lower rate is not a better loan", async () => {
    const r = await tool(searchHomeLoans, { purpose: "OWNER_OCCUPIED", sortBy: "published_rate" });
    expect(r.data.products[0].productId).toBe("A4");
    expect(r.data.sortedBy).toMatch(/not necessarily a better loan/);
  });

  it("filters by LVR tier and lists products with no published rate for that LVR", async () => {
    const r = await tool(searchHomeLoans, { lender: "alpha", purpose: "OWNER_OCCUPIED", rateType: "variable", lvrPercent: 90 });
    const a1 = r.data.products.find((p: any) => p.productId === "A1");
    expect(a1.rates.map((x: any) => x.publishedRate)).toEqual(["0.0629"]);
    const r2 = await tool(searchHomeLoans, { lender: "alpha", purpose: "OWNER_OCCUPIED", rateType: "variable", lvrPercent: 97 });
    expect(r2.data.noPublishedRateForLvr.map((x: any) => x.productId)).toContain("A1");
  });

  it("labels negotiated products and requires the offset feature when asked", async () => {
    const all = await tool(searchHomeLoans, { purpose: "OWNER_OCCUPIED" });
    expect(all.data.products.find((p: any) => p.productId === "A4").tailoredNote).toMatch(/not a quote/);
    const off = await tool(searchHomeLoans, { feature: "OFFSET" });
    expect(off.data.products.every((p: any) => p.offset)).toBe(true);
  });

  it("returns not found for filters that match nothing, with the coverage block", async () => {
    const r = await tool(searchHomeLoans, { rateType: "fixed", fixedTermYears: 7 });
    expect(r.found).toBe(false);
    expect(r.reason).toBe("not_in_dataset");
  });

  it("get_home_loan returns raw published figures and warns for a not-understood product", async () => {
    const ok = await tool(getHomeLoan, { lender: "alpha", productId: "A1" });
    expect(ok.data.allRates).toHaveLength(3);
    expect(ok.data.fees[0]).toMatchObject({ name: "Application fee", amount: "395.00" });
    const weird = await tool(getHomeLoan, { lender: "beta", productId: "B2" });
    expect(weird.found).toBe(true);
    expect(weird.warnings.join(" ")).toMatch(/Not fully understood/);
    expect((await tool(getHomeLoan, { lender: "alpha", productId: "nope" })).found).toBe(false);
  });

  it("compare refuses a not-understood product, shows no comparison rate it was not given, and flags mixed purposes", async () => {
    expect((await tool(compareHomeLoans, { products: ["alpha:A1", "beta:B2"] })).reason).toBe("needs_input");
    const r = await tool(compareHomeLoans, { products: ["alpha:A1", "beta:B1"], purpose: "OWNER_OCCUPIED", lvrPercent: 70 });
    expect(r.found).toBe(true);
    const b1 = r.data.products.find((p: any) => p.productId === "B1");
    expect(b1.rates[0].comparisonRatePercent).toBeUndefined();
    const mixed = await tool(compareHomeLoans, { products: ["alpha:A1", "beta:B1"] });
    expect(mixed.data.likeForLike).toBe(false);
    expect(mixed.data.notes.join(" ")).toMatch(/not like for like/);
  });

  it("calculator uses a stored rate with its source, or a user rate labelled as entered", async () => {
    const stored = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, lender: "beta", productId: "B1" });
    expect(stored.found).toBe(true);
    expect(stored.data.rateSource).toMatch(/rate as published/);
    expect(stored.data.ratePercentUsed).toBe("5.79%");
    expect(stored.data.notModelled.length).toBeGreaterThan(2);
    expect(stored.source.licence).toMatch(/Consumer Data Right/);
    const user = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, userRatePercent: 6 });
    expect(user.data.paymentPerPeriod).toBe("$2,997.75");
    expect(user.data.rateSource).toMatch(/entered by the user/);
    expect(user.data.notice).toMatch(/arithmetic on the rate shown/);
  });

  it("calculator asks which rate when several match, and refuses an offset on a product without the feature", async () => {
    const many = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, lender: "alpha", productId: "A1", purpose: "OWNER_OCCUPIED" });
    expect(many.reason).toBe("needs_input");
    expect(many.message).toMatch(/lvrPercent/);
    const off = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, lender: "beta", productId: "B1", avgOffsetBalance: 20000 });
    expect(off.reason).toBe("needs_input");
    expect(off.message).toMatch(/offset/);
    const okOff = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, lender: "alpha", productId: "A1", purpose: "OWNER_OCCUPIED", lvrPercent: 70, avgOffsetBalance: 50000 });
    expect(okOff.found).toBe(true);
    expect(okOff.data.interestSaved).toMatch(/illustrative/);
  });

  it("calculator for a fixed rate shorter than the term covers only the fixed period", async () => {
    const r = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, lender: "alpha", productId: "A2" });
    expect(r.data.coversFixedPeriodOnly).toMatch(/2 years/);
    expect(r.data.periodsRun).toBe(24);
  });

  it("calculator rejects absurd input with a message and no figures", async () => {
    const r = await tool(calculateHomeLoanRepayments, { loanAmount: 500000, termYears: 30, userRatePercent: 99 });
    expect(r.found).toBe(false);
  });

  it("reference rate carries the RBA attribution; none loaded is not found", async () => {
    const r = await tool(getHomeLoanReferenceRates, {});
    expect(r.data.cashRateTargetPercent).toBe("3.6%");
    expect(r.source.attribution).toMatch(/Reserve Bank of Australia/);
    await db.pool.query("TRUNCATE reference_rates");
    expect((await tool(getHomeLoanReferenceRates, {})).reason).toBe("no_data_loaded");
  });

  it("an excluded lender disappears from every tool and is counted", async () => {
    setHomeLoanRuntime({ data: () => readAll(db), excluded: parseExclusions({ ASKRIGHTO_HOME_LOAN_EXCLUDE: "Beta" } as any) });
    const s: any = await searchHomeLoans.handler({});
    expect(s.data.products.some((p: any) => p.lender === "beta")).toBe(false);
    expect(s.data.coverage.lendersExcluded).toBe(1);
    expect(((await getHomeLoan.handler({ lender: "beta", productId: "B1" })) as any).found).toBe(false);
  });

  it("answers data_unavailable with no runtime, and no_data_loaded when empty", async () => {
    setHomeLoanRuntime(undefined);
    expect(((await searchHomeLoans.handler({})) as any).reason).toBe("data_unavailable");
    setHomeLoanRuntime({ data: async () => ({ lenders: [], products: [], loadedAt: new Date() }), excluded: new Set() });
    expect(((await searchHomeLoans.handler({})) as any).reason).toBe("no_data_loaded");
  });
});
