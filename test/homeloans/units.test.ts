import { describe, expect, it } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { calculate } from "../../src/homeloans/calc.js";
import { CDR_LINKS, GUIDE_RULES, GUIDE_SECTIONS } from "../../src/homeloans/guide.js";
import { HOME_LOAN_INSTRUCTIONS } from "../../src/homeloans/instructions.js";
import { GUIDE_NOTICE, NOTICE_NOT_ADVICE } from "../../src/homeloans/notices.js";
import { HOME_LOAN_TOOLS } from "../../src/tools/home-loan-tools.js";
import { createServer } from "../../src/server/create-server.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";
import { call } from "../courses/helpers.js";

describe("calculator (integer cents)", () => {
  const base = { principalCents: 50_000_000, termYears: 30, annualRatePct: 6, frequency: "monthly" as const, repayment: "PRINCIPAL_AND_INTEREST" as const };
  it("matches the textbook payment for $500,000 at 6% over 30 years", () => {
    const r = calculate(base);
    expect(r.scheduledPaymentCents).toBe(299_775);
    expect(r.endBalanceCents).toBe(0);
  });
  it("interest-only pays interest and leaves the principal", () => {
    const r = calculate({ ...base, repayment: "INTEREST_ONLY" });
    expect(r.scheduledPaymentCents).toBe(250_000);
    expect(r.endBalanceCents).toBe(50_000_000);
  });
  it("extra repayments shorten the loan and save interest", () => {
    const r = calculate({ ...base, extraPerPeriodCents: 50_000 });
    expect(r.interestSavedCents).toBeGreaterThan(0);
    expect(r.periodsSaved).toBeGreaterThan(0);
  });
  it("is deterministic", () => expect(calculate(base)).toEqual(calculate(base)));
});

describe("guide content", () => {
  it("covers the three journeys and the structure facts from the real run", () => {
    expect(GUIDE_SECTIONS.map((s) => s.journey)).toEqual(["find", "read_product", "compare"]);
    const all = GUIDE_SECTIONS.flatMap((s) => s.steps).join("\n");
    for (const w of ["x-v", "406", "fraction", "DISCOUNT", "comparison rate", "cds-au/v1/banking/products"])
      expect(all).toContain(w);
    expect(CDR_LINKS.schemas).toMatch(/dsb-schema-tools/);
  });
  it("never recommends or promises approval", () => {
    for (const t of [HOME_LOAN_INSTRUCTIONS, GUIDE_NOTICE, ...GUIDE_RULES, ...HOME_LOAN_TOOLS.map((x) => x.description)])
      expect(t).not.toMatch(/you should (take|choose)|guaranteed approval/i);
    expect(NOTICE_NOT_ADVICE).toMatch(/not credit advice/);
  });
});

async function connect() {
  const set = routeSet(ALL_VERTICALS, ["energy", "home-loans"]);
  const server = createServer(set.tools, { route: "internal", instructions: set.instructions });
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe("home loan tools (index-only)", () => {
  it("serves the guide and the calculator only, and the data tools are gone", async () => {
    const { tools } = await (await connect()).listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_cdr_banking_guide", "calculate_home_loan_repayments"]));
    for (const n of ["search_home_loans", "get_home_loan", "compare_home_loans", "get_home_loan_reference_rates"])
      expect(names).not.toContain(n);
  });
  it("the guide says Ask Righto holds no lender data and carries links", async () => {
    const { data, text } = await call(await connect(), "get_cdr_banking_guide", { journey: "compare" });
    expect(data.found).toBe(true);
    expect(data.data.sections).toHaveLength(1);
    expect(data.data.notice).toMatch(/holds no lender data/);
    expect(text).toContain(CDR_LINKS.schemas);
    expect(data.source.licence).toMatch(/Links only/);
  });
  it("calculates on a rate the user enters and labels it as entered", async () => {
    const { data, text } = await call(await connect(), "calculate_home_loan_repayments", { loanAmount: 500000, termYears: 30, ratePercent: 6 });
    expect(data.found).toBe(true);
    expect(data.data.paymentPerPeriod).toBe("$2,997.75");
    expect(text).toMatch(/as entered/);
  });
});
