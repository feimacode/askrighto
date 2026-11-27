/**
 * Home loan tools (index-only): a guide to reading lenders' CDR product data, and repayment arithmetic on a rate the
 * user gives. Ask Righto stores no lender data and never ranks or judges suitability. Fixed notices are attached here.
 */
import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import {
  calculate,
  dollarsFromCents,
  type Frequency,
} from "../homeloans/calc.js";
import {
  CDR_LINKS,
  GUIDE_RULES,
  GUIDE_SECTIONS,
  JOURNEYS,
  type GuideSection,
} from "../homeloans/guide.js";
import {
  CALC_NOTICE,
  GUIDE_NOTICE,
  NOTICE_NOT_ADVICE,
  PROXY_NOTICE,
} from "../homeloans/notices.js";
import {
  getCdrProxy,
  MAX_PAGE_SIZE,
  ProxyError,
  resolveLender,
  type LenderBrand,
} from "../homeloans/proxy.js";

/** Date the guide's structure facts were last checked against a real run of lenders. */
export const GUIDE_CHECKED_ON = "2026-11-17";

// ---------------------------------------------------------------- get_cdr_banking_guide
interface GuideData {
  journey: string;
  links: typeof CDR_LINKS;
  sections: GuideSection[];
  rules: readonly string[];
  notice: string;
}

export const getCdrBankingGuide = defineTool({
  name: "get_cdr_banking_guide",
  title: "Guide to reading home loan data",
  description:
    "Says where lenders publish home loan rates and fees through the Consumer Data Right, how the product objects are structured, the quirks to watch for, and the wording rules. Ask Righto holds no lender data: the assistant fetches it from the lender and says so.",
  inputSchema: z.object({
    journey: z
      .enum(JOURNEYS)
      .optional()
      .describe(
        "find (lenders and endpoints), read_product (object structure), compare (fair comparison) or all (default)",
      ),
  }),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["cdr-banking-links"] as const,
  handler: (a) => {
    const j = a.journey ?? "all";
    return found({
      data: {
        journey: j,
        links: CDR_LINKS,
        sections: GUIDE_SECTIONS.filter((s) => j === "all" || s.journey === j),
        rules: GUIDE_RULES,
        notice: GUIDE_NOTICE,
      } as GuideData,
      source: {
        name: "Consumer Data Right Register and Data Standards (links only)",
        url: CDR_LINKS.cdrSite,
        licence: "Links only; Ask Righto stores no lender data",
      },
      asOf: `${GUIDE_CHECKED_ON}T00:00:00Z`,
    });
  },
  render: (d) =>
    [
      `Links: Register ${d.links.register}; brands API ${d.links.brandsApi}; schemas ${d.links.schemas}; standards ${d.links.standards}.`,
      ...d.sections.map(
        (s) => `## ${s.title}\n${s.steps.map((x) => `- ${x}`).join("\n")}`,
      ),
      "## Rules\n" + d.rules.map((x) => `- ${x}`).join("\n"),
      d.notice,
    ].join("\n"),
});

// ---------------------------------------------------------------- calculate_home_loan_repayments
const NOT_MODELLED = [
  "rate changes or what happens when a fixed or introductory rate ends",
  "fees and charges (shown separately on the product, not added in)",
  "redraw",
  "the way a lender calculates interest day by day",
];

interface CalcData {
  ratePercentUsed: string;
  inputs: Record<string, string | number>;
  formula: string;
  paymentPerPeriod: string;
  periodsPerYear: number;
  periodsRun: number;
  totalInterest: string;
  totalPaid: string;
  endBalance: string;
  interestSaved?: string;
  periodsSaved?: number;
  notModelled: string[];
  notice: string;
}

export const calculateHomeLoanRepayments = defineTool({
  name: "calculate_home_loan_repayments",
  title: "Calculate home loan repayments",
  description:
    "Arithmetic only: repayment, total interest and the effect of extra repayments or an offset balance, from the loan amount, term and annual rate the user gives (or a rate the assistant read from a lender, entered here as given). It is not an offer, a quote or advice and does not say whether the user could get the loan.",
  inputSchema: z.object({
    loanAmount: z
      .number()
      .min(1000)
      .max(100_000_000)
      .describe("Loan amount in dollars, as the user gave it"),
    termYears: z.number().min(1).max(40).describe("Loan term in years"),
    ratePercent: z
      .number()
      .min(0)
      .max(30)
      .describe("Annual interest rate as a percentage, e.g. 5.99"),
    frequency: z
      .enum(["monthly", "fortnightly", "weekly"])
      .optional()
      .describe("Repayment frequency, default monthly"),
    repayment: z
      .enum(["PRINCIPAL_AND_INTEREST", "INTEREST_ONLY"])
      .optional()
      .describe("Default principal and interest"),
    fixedTermYears: z
      .number()
      .min(0.5)
      .max(10)
      .optional()
      .describe("If the rate is fixed for this long, covers only that period"),
    extraRepaymentPerPeriod: z
      .number()
      .min(0)
      .max(1_000_000)
      .optional()
      .describe("Extra dollars paid each period"),
    avgOffsetBalance: z
      .number()
      .min(0)
      .max(100_000_000)
      .optional()
      .describe("Average offset balance in dollars"),
  }),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: (a) => {
    const repayment = a.repayment ?? "PRINCIPAL_AND_INTEREST";
    const frequency = (a.frequency ?? "monthly") as Frequency;
    const windowMonths =
      a.fixedTermYears !== undefined && a.fixedTermYears < a.termYears
        ? Math.round(a.fixedTermYears * 12)
        : undefined;
    let r;
    try {
      r = calculate({
        principalCents: Math.round(a.loanAmount * 100),
        termYears: a.termYears,
        annualRatePct: a.ratePercent,
        frequency,
        repayment,
        ...(a.extraRepaymentPerPeriod
          ? { extraPerPeriodCents: Math.round(a.extraRepaymentPerPeriod * 100) }
          : {}),
        ...(a.avgOffsetBalance
          ? { offsetCents: Math.round(a.avgOffsetBalance * 100) }
          : {}),
        ...(windowMonths !== undefined ? { windowMonths } : {}),
      });
    } catch (e) {
      return notFound("needs_input", (e as Error).message);
    }
    const data: CalcData = {
      ratePercentUsed: `${a.ratePercent}%`,
      inputs: {
        loanAmount: dollarsFromCents(Math.round(a.loanAmount * 100)),
        termYears: a.termYears,
        frequency,
        repayment,
        ...(a.extraRepaymentPerPeriod
          ? {
              extraRepaymentPerPeriod: dollarsFromCents(
                Math.round(a.extraRepaymentPerPeriod * 100),
              ),
            }
          : {}),
        ...(a.avgOffsetBalance
          ? {
              avgOffsetBalance: dollarsFromCents(
                Math.round(a.avgOffsetBalance * 100),
              ),
            }
          : {}),
      },
      formula:
        repayment === "INTEREST_ONLY"
          ? "Interest-only: each period's interest = balance less offset × (annual rate ÷ periods a year), rounded to the cent; the principal is unchanged."
          : "Standard amortisation: payment = P × r ÷ (1 − (1 + r)^−n), with r = annual rate ÷ periods a year and n = periods in the term, rounded to the cent; interest each period is charged on the balance less any offset; the last payment is trimmed.",
      paymentPerPeriod: dollarsFromCents(r.scheduledPaymentCents),
      periodsPerYear: r.periodsPerYear,
      periodsRun: r.periodsRun,
      totalInterest: dollarsFromCents(r.totalInterestCents),
      totalPaid: dollarsFromCents(r.totalPaidCents),
      endBalance: dollarsFromCents(r.endBalanceCents),
      ...(r.interestSavedCents !== undefined
        ? {
            interestSaved: `${dollarsFromCents(r.interestSavedCents)} less interest than the same loan without the extra repayments or offset (illustrative)`,
          }
        : {}),
      ...(r.periodsSaved ? { periodsSaved: r.periodsSaved } : {}),
      notModelled: NOT_MODELLED,
      notice: `${CALC_NOTICE} ${NOTICE_NOT_ADVICE}`,
    };
    return found({
      data,
      source: {
        name: "Ask Righto repayment arithmetic on figures you entered",
        url: "https://askrighto.feimacode.com",
        licence: "Not applicable: calculated from your inputs",
      },
      asOf: new Date(),
    });
  },
  render: (r) =>
    [
      `Rate used: ${r.ratePercentUsed}, as entered.`,
      `Inputs: ${Object.entries(r.inputs)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}.`,
      `Repayment each period: ${r.paymentPerPeriod}. Total interest: ${r.totalInterest}. Total paid: ${r.totalPaid}. Balance at the end of the calculation: ${r.endBalance} after ${r.periodsRun} periods.`,
      r.interestSaved
        ? `${r.interestSaved}${r.periodsSaved ? `, finishing ${r.periodsSaved} periods earlier` : ""}.`
        : "",
      `Method: ${r.formula}`,
      `Not modelled: ${r.notModelled.join("; ")}.`,
      r.notice,
    ]
      .filter(Boolean)
      .join("\n"),
});

// ---------------------------------------------------------------- list_home_loan_lenders / get_home_loan_products
const ro = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;
const CDR_SOURCE_LICENCE =
  "Consumer Data Right Rules: product data disclosed without conditions on use";

const proxyDown = (e: unknown) => {
  if (e instanceof ProxyError)
    return notFound(
      "data_unavailable",
      `${e.message} Give the user the lender's own home loan page instead, and quote no figure from memory.`,
      { kind: e.kind, ...(e.status ? { status: e.status } : {}) },
    );
  throw e;
};

interface LendersData {
  total: number;
  lenders: LenderBrand[];
  notice: string;
}

export const listHomeLoanLenders = defineTool({
  name: "list_home_loan_lenders",
  title: "List lenders publishing home loan data",
  description:
    "Lists banking brands in the Consumer Data Right Register with their brand id and public base URI, optionally filtered by a name fragment. Use a brand id or exact name with get_home_loan_products. Read live from the Register; nothing is stored.",
  inputSchema: z.object({
    name: z
      .string()
      .max(60)
      .optional()
      .describe("Part of a lender's name, e.g. westpac"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Lenders to return, default 20"),
  }),
  ...ro,
  datasets: ["cdr-banking-live"] as const,
  handler: async (a) => {
    let brands: LenderBrand[];
    try {
      brands = await getCdrProxy().brands();
    } catch (e) {
      return proxyDown(e);
    }
    const q = a.name?.trim().toLowerCase();
    const hits = q
      ? brands.filter((b) => b.name.toLowerCase().includes(q))
      : brands;
    if (hits.length === 0)
      return notFound(
        "not_in_dataset",
        `No banking brand in the CDR Register matches "${a.name}". Check the spelling, or the lender may not publish through the Consumer Data Right.`,
      );
    return found({
      data: {
        total: hits.length,
        lenders: hits.slice(0, a.limit ?? 20),
        notice: PROXY_NOTICE,
      } as LendersData,
      source: {
        name: "CDR Register, banking brands",
        url: "https://www.cdr.gov.au/find-a-provider",
        licence: "Consumer Data Right Register (public)",
      },
      asOf: new Date(),
    });
  },
  render: (d) =>
    [
      `${d.lenders.length} of ${d.total} lenders.`,
      ...d.lenders.map((l) => `- ${l.name} (id ${l.id})`),
      d.notice,
    ].join("\n"),
});

interface ProductsData {
  lender: { id: string; name: string };
  endpoint: string;
  xVersionUsed: number;
  fetchedAt: string;
  lenderResponse: unknown;
  notice: string;
}

export const getHomeLoanProducts = defineTool({
  name: "get_home_loan_products",
  title: "Read a lender's home loan data",
  description:
    "Fetches live from one lender's Consumer Data Right endpoint, with the right version header, either its residential mortgage product list (paged) or one product's detail, and returns the lender's JSON unchanged with the lender URL and the time fetched. Ask Righto stores nothing. Rates are fractions (0.0599 is 5.99%). Use get_cdr_banking_guide for the object structure and quirks.",
  inputSchema: z.object({
    lender: z
      .string()
      .min(2)
      .max(80)
      .describe("Brand id or name from list_home_loan_lenders"),
    productId: z
      .string()
      .max(128)
      .optional()
      .describe(
        "A productId from the list, to get that product's detail instead of the list",
      ),
    page: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("List page, default 1"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .describe("Products per list page, default 10"),
  }),
  ...ro,
  datasets: ["cdr-banking-live"] as const,
  handler: async (a) => {
    const proxy = getCdrProxy();
    let brand: LenderBrand;
    try {
      const r = resolveLender(await proxy.brands(), a.lender);
      if (!r.ok)
        return notFound(
          "needs_input",
          r.candidates.length
            ? `"${a.lender}" matches more than one lender. Use the id of one: ${r.candidates.map((c) => `${c.name} (${c.id})`).join("; ")}.`
            : `No banking brand in the CDR Register matches "${a.lender}". Use list_home_loan_lenders.`,
          { candidates: r.candidates.map((c) => ({ id: c.id, name: c.name })) },
        );
      brand = r.brand;
    } catch (e) {
      return proxyDown(e);
    }
    try {
      const res = a.productId
        ? await proxy.detail(brand, a.productId)
        : await proxy.list(brand, a.page ?? 1, a.pageSize ?? 10);
      return found({
        data: {
          lender: { id: brand.id, name: brand.name },
          endpoint: res.endpoint,
          xVersionUsed: res.xVersion,
          fetchedAt: res.fetchedAt,
          lenderResponse: res.body,
          notice: PROXY_NOTICE,
        } as ProductsData,
        source: {
          name: `${brand.name}, Consumer Data Right product data (live, not stored)`,
          url: res.endpoint,
          licence: CDR_SOURCE_LICENCE,
        },
        asOf: res.fetchedAt,
      });
    } catch (e) {
      return proxyDown(e);
    }
  },
  render: (d) =>
    [
      `${d.lender.name}: ${d.endpoint} (x-v ${d.xVersionUsed}), fetched ${d.fetchedAt}. Figures below are the lender's, as published.`,
      JSON.stringify(d.lenderResponse),
      d.notice,
    ].join("\n"),
});

export const HOME_LOAN_TOOLS = [
  listHomeLoanLenders,
  getHomeLoanProducts,
  getCdrBankingGuide,
  calculateHomeLoanRepayments,
] as const;
