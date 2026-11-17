/**
 * Home loan tools. They list and compare what lenders published, and do arithmetic from a published or
 * user-entered rate. They never rank by suitability, assess eligibility, or tell anyone which loan to take.
 * Fixed notices are attached here (not by the host model) to every found result. DRAFT wording: legal view pending.
 */
import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Grounded } from "../core/grounded.js";
import { calculate, dollarsFromCents, type Frequency } from "../homeloans/calc.js";
import { withHomeLoans } from "../homeloans/index.js";
import {
  BANK_SOURCE, CALC_NOTICE, COVERAGE_WORDS, HOME_LOAN_NOTICE, RBA_SOURCE,
} from "../homeloans/notices.js";
import {
  fixedYearsLabel, hasFeature, isExpired, selectRates, type RateFilter,
} from "../homeloans/select.js";
import type { HomeLoanData, HomeLoanProduct, LoanRate } from "../homeloans/types.js";
import { ANSWERING_WINDOW_MS } from "../homeloans/index.js";

const base = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, datasets: ["home-loans-cdr"] as const } as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const pct = (n: number) => `${n}%`;
const withNotice = (t: string) => `${t}\n\n${HOME_LOAN_NOTICE}`;

// ---------------------------------------------------------------- shared views
export interface RateView {
  type: string;
  /** As published, a fraction string. */
  publishedRate: string;
  ratePercent: string;
  comparisonRatePercent?: string;
  purpose: string;
  repayment: string;
  fixedTerm?: string;
  lvrTiers: string[];
  conditions: string[];
}

function rateView(r: LoanRate): RateView {
  return {
    type: r.type,
    publishedRate: r.rate,
    ratePercent: pct(r.ratePct),
    ...(r.comparisonRatePct !== undefined ? { comparisonRatePercent: `${pct(r.comparisonRatePct)} (as published by the lender)` } : {}),
    purpose: r.purpose,
    repayment: r.repayment,
    ...(fixedYearsLabel(r) ? { fixedTerm: fixedYearsLabel(r)! } : {}),
    lvrTiers: r.tiers
      .filter((t) => t.unit === "PERCENT_LVR")
      .map((t) => `LVR ${Number(t.min) * 100}% to ${t.max !== undefined ? Number(t.max) * 100 + "%" : "no upper limit"}`),
    conditions: r.conditions,
  };
}

export interface ProductRow {
  lender: string;
  lenderName: string;
  productId: string;
  name: string;
  rates: RateView[];
  tailored: boolean;
  tailoredNote?: string;
  offset: boolean;
  redraw: boolean;
  links: HomeLoanProduct["links"];
  verifiedAt: string;
}

const TAILORED_NOTE = "The lender says this product's rate is negotiated, so the published figure is not a quote.";

function row(p: HomeLoanProduct, rates: LoanRate[]): ProductRow {
  return {
    lender: p.lenderSlug,
    lenderName: p.brandName,
    productId: p.productId,
    name: p.name,
    rates: rates.map(rateView),
    tailored: p.isTailored,
    ...(p.isTailored ? { tailoredNote: TAILORED_NOTE } : {}),
    offset: hasFeature(p, "OFFSET"),
    redraw: hasFeature(p, "REDRAW"),
    links: p.links,
    verifiedAt: p.verifiedAt,
  };
}

interface Coverage {
  lendersInList: number;
  lendersAnswering: number;
  lendersExcluded: number;
  productsConsidered: number;
  excludedNotUnderstood: number;
  excludedExpired: number;
  wording: string;
}

function coverage(d: HomeLoanData, excluded: ReadonlySet<string>, now: Date, notUnderstood: number, expired: number, considered: number): Coverage {
  const active = d.lenders.filter((l) => l.active && !excluded.has(l.slug));
  return {
    lendersInList: active.length,
    lendersAnswering: active.filter((l) => l.lastSyncOk && l.lastSyncAt && now.getTime() - l.lastSyncAt.getTime() < ANSWERING_WINDOW_MS).length,
    lendersExcluded: d.lenders.filter((l) => excluded.has(l.slug)).length,
    productsConsidered: considered,
    excludedNotUnderstood: notUnderstood,
    excludedExpired: expired,
    wording: `The list covers ${COVERAGE_WORDS}, not every lender in the market.`,
  };
}

const okResult = <T extends object>(data: T, asOf: Date | string, warnings: string[] = []) =>
  found({ data: { ...data, notice: HOME_LOAN_NOTICE }, source: { ...BANK_SOURCE }, asOf, warnings });

function visible(d: HomeLoanData, excluded: ReadonlySet<string>, now: Date) {
  const considered = d.products.filter((p) => !excluded.has(p.lenderSlug));
  const live = considered.filter((p) => !isExpired(p, now));
  const usable = live.filter((p) => p.understood);
  return { considered, usable, expired: considered.length - live.length, notUnderstood: live.length - usable.length };
}

const oldest = (ps: HomeLoanProduct[]) => new Date(Math.min(...ps.map((p) => Date.parse(p.verifiedAt))));

const purposeEnum = z.enum(["OWNER_OCCUPIED", "INVESTMENT"]);
const repayEnum = z.enum(["PRINCIPAL_AND_INTEREST", "INTEREST_ONLY"]);
const kindEnum = z.enum(["variable", "fixed", "any"]);

function filterOf(a: { purpose?: string | undefined; repayment?: string | undefined; rateType?: string | undefined; fixedTermYears?: number | undefined; lvrPercent?: number | undefined }): RateFilter {
  return {
    ...(a.purpose ? { purpose: a.purpose as RateFilter["purpose"] } : {}),
    ...(a.repayment ? { repayment: a.repayment as RateFilter["repayment"] } : {}),
    kind: (a.rateType as RateFilter["kind"]) ?? "any",
    ...(a.fixedTermYears !== undefined ? { fixedTermYears: a.fixedTermYears } : {}),
    ...(a.lvrPercent !== undefined ? { lvrPercent: a.lvrPercent } : {}),
  };
}

const findProduct = (d: HomeLoanData, excluded: ReadonlySet<string>, lender: string, id: string) =>
  d.products.find((p) => !excluded.has(p.lenderSlug) && p.productId === id && (norm(p.lenderSlug) === norm(lender) || norm(p.brandName) === norm(lender)));

const rateLine = (r: RateView) =>
  `${r.ratePercent} ${r.type.toLowerCase().replace(/_/g, " ")}${r.fixedTerm ? ` (${r.fixedTerm})` : ""}, ${r.purpose.toLowerCase().replace(/_/g, " ")}, ${r.repayment.toLowerCase().replace(/_/g, " ")}${r.lvrTiers.length ? `, ${r.lvrTiers.join("; ")}` : ""}${r.comparisonRatePercent ? `, comparison rate ${r.comparisonRatePercent}` : ", no comparison rate published"}`;

const productLines = (p: ProductRow) =>
  [
    `- ${p.lenderName}: ${p.name} (id ${p.productId})${p.tailored ? " [rate is negotiated; published figure is not a quote]" : ""}`,
    ...p.rates.map((r) => `    ${rateLine(r)}`),
    `    features: ${[p.offset ? "offset" : "", p.redraw ? "redraw" : ""].filter(Boolean).join(", ") || "none listed here"}${p.links.product ? `; ${p.links.product}` : ""}`,
  ].join("\n");

// ---------------------------------------------------------------- search_home_loans
interface SearchData {
  sortedBy: string;
  matched: number;
  returned: number;
  products: ProductRow[];
  noPublishedRateForLvr: Array<{ lender: string; lenderName: string; name: string; productId: string }>;
  coverage: Coverage;
  notice: string;
}

export const searchHomeLoans = defineTool({
  name: "search_home_loans",
  title: "Search published home loans",
  description:
    "Lists home loan products and the rates lenders have published through the Consumer Data Right, filtered by purpose (owner-occupier or investor), repayment type, variable or fixed (with a term), the user's own LVR figure, a feature such as offset, or lender. Sorted only by a field the user asks for; otherwise by lender name with no ranking. Information only: it does not recommend, assess eligibility or say what suits anyone.",
  inputSchema: z.object({
    purpose: purposeEnum.optional().describe("Owner-occupier or investment loan"),
    repayment: repayEnum.optional().describe("Principal and interest, or interest only"),
    rateType: kindEnum.optional().describe("Variable, fixed or any (default any)"),
    fixedTermYears: z.number().min(0.5).max(10).optional().describe("Fixed term in years, with rateType fixed"),
    lvrPercent: z.number().min(1).max(100).optional().describe("The user's own loan to value ratio as a percentage, e.g. 80. Never estimate it for them"),
    feature: z.enum(["OFFSET", "REDRAW", "EXTRA_REPAYMENTS"]).optional().describe("Require a published feature"),
    lender: z.string().max(60).optional().describe("Lender name, e.g. a bank's brand"),
    sortBy: z.enum(["published_rate", "published_comparison_rate"]).optional().describe("Sort field, only if the user asked for sorting"),
    limit: z.number().int().min(1).max(25).optional().describe("Products to return, default 15"),
  }),
  ...base,
  handler: (a) =>
    withHomeLoans<SearchData>((d, rt) => {
      const now = new Date();
      const v = visible(d, rt.excluded, now);
      const f = filterOf(a);
      let pool = v.usable;
      if (a.lender) pool = pool.filter((p) => norm(p.brandName).includes(norm(a.lender!)) || norm(p.lenderSlug).includes(norm(a.lender!)));
      if (a.feature) pool = pool.filter((p) => hasFeature(p, a.feature!));
      const rows: Array<{ p: HomeLoanProduct; rates: LoanRate[] }> = [];
      const noLvr: SearchData["noPublishedRateForLvr"] = [];
      for (const p of pool) {
        const s = selectRates(p, f);
        if (s.rates.length) rows.push({ p, rates: s.rates });
        else if (s.noRateForLvr) noLvr.push({ lender: p.lenderSlug, lenderName: p.brandName, name: p.name, productId: p.productId });
      }
      const lowest = (x: { rates: LoanRate[] }) => Math.min(...x.rates.map((r) => r.ratePct));
      const lowestCmp = (x: { rates: LoanRate[] }) => Math.min(...x.rates.map((r) => r.comparisonRatePct ?? Infinity));
      let sortedBy = "lender name (no ranking applied)";
      if (a.sortBy === "published_rate") {
        rows.sort((x, y) => lowest(x) - lowest(y));
        sortedBy = "lowest published rate first, as you asked; a lower rate is not necessarily a better loan";
      } else if (a.sortBy === "published_comparison_rate") {
        rows.sort((x, y) => lowestCmp(x) - lowestCmp(y));
        sortedBy = "lowest published comparison rate first, as you asked (products with none come last)";
      } else rows.sort((x, y) => x.p.brandName.localeCompare(y.p.brandName) || x.p.name.localeCompare(y.p.name));
      if (rows.length === 0 && noLvr.length === 0)
        return notFound("not_in_dataset", "No published home loan matches those filters. Try fewer filters. The list covers lenders publishing through the Consumer Data Right, not every lender.", {
          coverage: coverage(d, rt.excluded, now, v.notUnderstood, v.expired, v.considered.length),
        });
      const limit = a.limit ?? 15;
      const shown = rows.slice(0, limit);
      const asOfPool = shown.length ? shown.map((x) => x.p) : pool;
      return okResult<SearchData>(
        {
          sortedBy,
          matched: rows.length,
          returned: shown.length,
          products: shown.map((x) => row(x.p, x.rates)),
          noPublishedRateForLvr: noLvr.slice(0, 25),
          coverage: coverage(d, rt.excluded, now, v.notUnderstood, v.expired, v.considered.length),
          notice: HOME_LOAN_NOTICE,
        },
        oldest(asOfPool),
      );
    }),
  render: (r) =>
    withNotice(
      [
        `${r.matched} product(s) matched; showing ${r.returned}. Order: ${r.sortedBy}.`,
        r.products.map(productLines).join("\n"),
        r.noPublishedRateForLvr.length
          ? `No published rate for the LVR given: ${r.noPublishedRateForLvr.map((x) => `${x.lenderName} ${x.name}`).join("; ")}.`
          : "",
        `Coverage: ${r.coverage.lendersInList} lender(s) in the list, ${r.coverage.lendersAnswering} answering in the last 48 hours; ${r.coverage.excludedNotUnderstood} product(s) left out because their published data could not be read reliably, ${r.coverage.excludedExpired} expired, ${r.coverage.lendersExcluded} lender(s) removed pending a data check. ${r.coverage.wording}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
});

// ---------------------------------------------------------------- get_home_loan
interface GetData extends ProductRow {
  description: string;
  allRates: RateView[];
  fees: HomeLoanProduct["fees"];
  features: HomeLoanProduct["features"];
  constraints: HomeLoanProduct["constraints"];
  eligibility: string[];
  understood: boolean;
  notUnderstood: string[];
  expired: boolean;
  notice: string;
}

export const getHomeLoan = defineTool({
  name: "get_home_loan",
  title: "Get one published home loan",
  description:
    "Returns everything a lender published for one home loan product: every rate and tier, comparison rates, fees, features, constraints, eligibility notes and the lender's links. Use search_home_loans to find the lender and product id. Information only.",
  inputSchema: z.object({
    lender: z.string().min(1).max(60).describe("Lender slug or name from search_home_loans"),
    productId: z.string().min(1).max(120).describe("Product id from search_home_loans"),
  }),
  ...base,
  handler: (a) =>
    withHomeLoans<GetData>((d, rt) => {
      const p = findProduct(d, rt.excluded, a.lender, a.productId);
      if (!p) return notFound("not_in_dataset", `No home loan with id "${a.productId}" from "${a.lender}" is in the Ask Righto list. Use search_home_loans to find ids.`);
      const expired = isExpired(p, new Date());
      return okResult<GetData>(
        {
          ...row(p, p.rates),
          description: p.description,
          allRates: p.rates.map(rateView),
          fees: p.fees,
          features: p.features,
          constraints: p.constraints,
          eligibility: p.eligibility,
          understood: p.understood,
          notUnderstood: p.notUnderstood,
          expired,
          notice: HOME_LOAN_NOTICE,
        },
        p.verifiedAt,
        [
          ...(p.understood ? [] : [`Not fully understood (${p.notUnderstood.join(", ")}). Raw published rates are shown; check the lender's page. This product is left out of comparisons and calculations.`]),
          ...(expired ? ["The lender's data shows this product as no longer offered."] : []),
        ],
      );
    }),
  render: (r) =>
    withNotice(
      [
        productLines(r),
        r.description ? `About: ${r.description}` : "",
        r.fees.length ? `Fees as published:\n${r.fees.map((f) => `    ${f.name} (${f.feeType.toLowerCase()}): ${f.amount ? "$" + f.amount : f.rate ? `${f.rate} (${f.rateType ?? "rate based"})` : f.note ?? "variable"}`).join("\n")}` : "No fees published.",
        r.constraints.length ? `Constraints: ${r.constraints.map((c) => `${c.type}${c.value ? " " + c.value : ""}`).join("; ")}` : "",
        r.eligibility.length ? `Eligibility notes: ${r.eligibility.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
});

// ---------------------------------------------------------------- compare_home_loans
interface CompareData {
  products: ProductRow[];
  likeForLike: boolean;
  notes: string[];
  fees: Array<{ product: string; fees: HomeLoanProduct["fees"] }>;
  notice: string;
}

export const compareHomeLoans = defineTool({
  name: "compare_home_loans",
  title: "Compare published home loans",
  description:
    "Shows two to five published home loans side by side: the rate matching the user's filters, comparison rate if the lender published one, fees, features and links. Picks no winner. Products are given as lender:productId from search_home_loans.",
  inputSchema: z.object({
    products: z.array(z.string().min(3).max(200)).min(2).max(5).describe("Products as lender:productId"),
    purpose: purposeEnum.optional(),
    repayment: repayEnum.optional(),
    rateType: kindEnum.optional(),
    fixedTermYears: z.number().min(0.5).max(10).optional(),
    lvrPercent: z.number().min(1).max(100).optional().describe("The user's own LVR percentage"),
  }),
  ...base,
  handler: (a) =>
    withHomeLoans<CompareData>((d, rt) => {
      const f = filterOf(a);
      const picked: HomeLoanProduct[] = [];
      for (const ref of a.products) {
        const i = ref.indexOf(":");
        const p = i > 0 ? findProduct(d, rt.excluded, ref.slice(0, i), ref.slice(i + 1)) : undefined;
        if (!p) return notFound("not_in_dataset", `"${ref}" is not a product in the list. Give each product as lender:productId from search_home_loans.`);
        if (!p.understood) return notFound("needs_input", `${p.brandName} ${p.name} could not be read reliably from the lender's published data, so it is left out of comparisons. See get_home_loan for the raw published figures.`);
        picked.push(p);
      }
      const selections = picked.map((p) => ({ p, s: selectRates(p, f) }));
      const notes: string[] = [];
      for (const x of selections) if (x.s.rates.length === 0) notes.push(`${x.p.brandName} ${x.p.name}: no published rate matches those filters${x.s.noRateForLvr ? " for that LVR" : ""}.`);
      const purposes = new Set(selections.flatMap((x) => x.s.rates.map((r) => r.purpose)));
      const repayments = new Set(selections.flatMap((x) => x.s.rates.map((r) => r.repayment)));
      const likeForLike = purposes.size <= 1 && repayments.size <= 1;
      if (!likeForLike) notes.push("The rates shown apply to different purposes or repayment types, so they are not like for like. Add purpose and repayment filters.");
      return okResult<CompareData>(
        {
          products: selections.map((x) => row(x.p, x.s.rates)),
          likeForLike,
          notes,
          fees: picked.map((p) => ({ product: `${p.brandName} ${p.name}`, fees: p.fees })),
          notice: HOME_LOAN_NOTICE,
        },
        oldest(picked),
      );
    }),
  render: (r) =>
    withNotice(
      [
        r.products.map(productLines).join("\n"),
        ...r.fees.map((x) => `Fees, ${x.product}: ${x.fees.length ? x.fees.map((f) => `${f.name} ${f.amount ? "$" + f.amount : f.rate ?? f.note ?? "variable"}`).join("; ") : "none published"}`),
        ...r.notes,
      ].join("\n"),
    ),
});

// ---------------------------------------------------------------- calculate_home_loan_repayments
interface CalcData {
  rateSource: string;
  ratePercentUsed: string;
  inputs: Record<string, string | number>;
  formula: string;
  paymentPerPeriod: string;
  periodsPerYear: number;
  periodsRun: number;
  totalInterest: string;
  totalPaid: string;
  endBalance: string;
  coversFixedPeriodOnly?: string;
  interestSaved?: string;
  periodsSaved?: number;
  notModelled: string[];
  product?: { lender: string; name: string; productId: string; link?: string };
  notice: string;
}

const NOT_MODELLED = [
  "rate changes or what happens when a fixed or introductory rate ends",
  "fees and charges (shown separately on the product, not added in)",
  "redraw",
  "the way a lender calculates interest day by day",
];

export const calculateHomeLoanRepayments = defineTool({
  name: "calculate_home_loan_repayments",
  title: "Calculate home loan repayments",
  description:
    "Arithmetic only: repayment, total interest and the effect of extra repayments or an offset balance, from the user's loan amount and term and either a stored lender's published rate or a rate the user typed. It is not an offer, a quote or advice and does not say whether the user could get the loan.",
  inputSchema: z.object({
    loanAmount: z.number().min(1000).max(100_000_000).describe("Loan amount in dollars, as the user gave it"),
    termYears: z.number().min(1).max(40).describe("Loan term in years"),
    frequency: z.enum(["monthly", "fortnightly", "weekly"]).optional().describe("Repayment frequency, default monthly"),
    repayment: repayEnum.optional().describe("Default principal and interest"),
    lender: z.string().max(60).optional().describe("Lender slug or name, with productId, to use a published rate"),
    productId: z.string().max(120).optional(),
    purpose: purposeEnum.optional().describe("Picks the published rate of a product that has several"),
    rateType: kindEnum.optional(),
    fixedTermYears: z.number().min(0.5).max(10).optional(),
    lvrPercent: z.number().min(1).max(100).optional(),
    userRatePercent: z.number().min(0).max(30).optional().describe("A rate the user typed, e.g. one they were quoted. Labelled as entered by the user"),
    extraRepaymentPerPeriod: z.number().min(0).max(1_000_000).optional().describe("Extra dollars paid each period"),
    avgOffsetBalance: z.number().min(0).max(100_000_000).optional().describe("Average offset balance in dollars, only for products with a published offset feature"),
  }),
  ...base,
  handler: (a) =>
    withHomeLoans<CalcData>((d, rt) => {
      const repayment = a.repayment ?? "PRINCIPAL_AND_INTEREST";
      const frequency = (a.frequency ?? "monthly") as Frequency;
      let ratePct: number;
      let rateSource: string;
      let product: HomeLoanProduct | undefined;
      let rate: LoanRate | undefined;
      if (a.userRatePercent !== undefined) {
        ratePct = a.userRatePercent;
        rateSource = "a rate entered by the user (Ask Righto makes no claim about where it came from)";
        if (a.lender && a.productId) product = findProduct(d, rt.excluded, a.lender, a.productId);
      } else {
        if (!a.lender || !a.productId)
          return notFound("needs_input", "Give either a rate the user typed (userRatePercent) or a lender and productId from search_home_loans to use that product's published rate.");
        product = findProduct(d, rt.excluded, a.lender, a.productId);
        if (!product) return notFound("not_in_dataset", `No home loan with id "${a.productId}" from "${a.lender}" is in the list. Use search_home_loans.`);
        if (!product.understood) return notFound("needs_input", `${product.brandName} ${product.name} could not be read reliably from the lender's published data, so it is left out of calculations.`);
        const s = selectRates(product, filterOf({ ...a, repayment }));
        if (s.rates.length === 0)
          return notFound("needs_input", `No published rate of ${product.brandName} ${product.name} matches those filters${s.noRateForLvr ? " for that LVR" : ""}. Check get_home_loan, or give userRatePercent.`);
        if (s.rates.length > 1)
          return notFound("needs_input", `${product.brandName} ${product.name} publishes ${s.rates.length} rates that match: ${s.rates.map((r) => `${pct(r.ratePct)} ${r.type.toLowerCase()}${r.fixedTermMonths ? " " + fixedYearsLabel(r) : ""}`).join("; ")}. Add purpose, rateType, fixedTermYears or lvrPercent to pick one.`);
        rate = s.rates[0]!;
        ratePct = rate.ratePct;
        rateSource = `${product.brandName} ${product.name}, rate as published${rate.fixedTermMonths ? ` (fixed ${fixedYearsLabel(rate)})` : ""}`;
      }
      if (a.avgOffsetBalance && product && !hasFeature(product, "OFFSET"))
        return notFound("needs_input", `${product.brandName} ${product.name} does not publish an offset feature, so an offset balance is not modelled for it. Leave avgOffsetBalance out.`);
      const fixedMonths = rate?.fixedTermMonths;
      const windowMonths = fixedMonths !== undefined && fixedMonths < a.termYears * 12 ? fixedMonths : undefined;
      let r;
      try {
        r = calculate({
          principalCents: Math.round(a.loanAmount * 100),
          termYears: a.termYears,
          annualRatePct: ratePct,
          frequency,
          repayment,
          ...(a.extraRepaymentPerPeriod ? { extraPerPeriodCents: Math.round(a.extraRepaymentPerPeriod * 100) } : {}),
          ...(a.avgOffsetBalance ? { offsetCents: Math.round(a.avgOffsetBalance * 100) } : {}),
          ...(windowMonths !== undefined ? { windowMonths } : {}),
        });
      } catch (e) {
        return notFound("needs_input", (e as Error).message);
      }
      const data: CalcData = {
        rateSource,
        ratePercentUsed: pct(ratePct),
        inputs: {
          loanAmount: dollarsFromCents(Math.round(a.loanAmount * 100)),
          termYears: a.termYears,
          frequency,
          repayment,
          ...(a.extraRepaymentPerPeriod ? { extraRepaymentPerPeriod: dollarsFromCents(Math.round(a.extraRepaymentPerPeriod * 100)) } : {}),
          ...(a.avgOffsetBalance ? { avgOffsetBalance: dollarsFromCents(Math.round(a.avgOffsetBalance * 100)) } : {}),
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
        ...(windowMonths !== undefined
          ? { coversFixedPeriodOnly: `Covers only the ${fixedYearsLabel(rate!)} fixed period. The rate after it is not assumed; the balance shown is what remains at its end.` }
          : {}),
        ...(r.interestSavedCents !== undefined ? { interestSaved: `${dollarsFromCents(r.interestSavedCents)} less interest than the same loan without the extra repayments or offset (illustrative)` } : {}),
        ...(r.periodsSaved ? { periodsSaved: r.periodsSaved } : {}),
        notModelled: NOT_MODELLED,
        ...(product ? { product: { lender: product.brandName, name: product.name, productId: product.productId, ...(product.links.product ? { link: product.links.product } : {}) } } : {}),
        notice: `${CALC_NOTICE} ${HOME_LOAN_NOTICE}`,
      };
      return found({
        data,
        source: product
          ? { ...BANK_SOURCE }
          : { name: "Ask Righto repayment arithmetic on figures you entered", url: "https://askrighto.com.au", licence: "Not applicable: calculated from your inputs" },
        asOf: product ? product.verifiedAt : new Date(),
      });
    }),
  render: (r) =>
    [
      `Rate used: ${r.ratePercentUsed}, from ${r.rateSource}.`,
      `Inputs: ${Object.entries(r.inputs).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
      `Repayment each period: ${r.paymentPerPeriod}. Total interest: ${r.totalInterest}. Total paid: ${r.totalPaid}. Balance at the end of the calculation: ${r.endBalance} after ${r.periodsRun} periods.`,
      r.coversFixedPeriodOnly ?? "",
      r.interestSaved ? `${r.interestSaved}${r.periodsSaved ? `, finishing ${r.periodsSaved} periods earlier` : ""}.` : "",
      `Method: ${r.formula}`,
      `Not modelled: ${r.notModelled.join("; ")}.`,
      r.notice,
    ]
      .filter(Boolean)
      .join("\n"),
});

// ---------------------------------------------------------------- get_home_loan_reference_rates
interface RefData {
  cashRateTargetPercent: string;
  effectiveDate: string;
  sourceLink: string;
  note: string;
}

export const getHomeLoanReferenceRates = defineTool({
  name: "get_home_loan_reference_rates",
  title: "Get the RBA cash rate target",
  description:
    "Returns the Reserve Bank of Australia's cash rate target and the date it took effect, with attribution. It does not forecast and does not say what any lender will charge: lenders set their own rates.",
  inputSchema: z.object({}),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["rba-cash-rate"],
  handler: () =>
    withHomeLoans<RefData>((d) => {
      if (!d.cashRate) return notFound("no_data_loaded", "No cash rate has been loaded on this server yet.");
      return found({
        data: {
          cashRateTargetPercent: pct(d.cashRate.valuePct),
          effectiveDate: d.cashRate.effectiveDate,
          sourceLink: d.cashRate.sourceUrl,
          note: "Lenders set their own home loan rates; this figure does not tell you what any lender charges or will charge.",
        },
        source: { ...RBA_SOURCE },
        asOf: d.cashRate.fetchedAt,
      });
    }),
  render: (r) => `RBA cash rate target: ${r.cashRateTargetPercent}, effective ${r.effectiveDate} (${r.sourceLink}).\n${r.note}`,
});

export const HOME_LOAN_TOOLS = [searchHomeLoans, getHomeLoan, compareHomeLoans, calculateHomeLoanRepayments, getHomeLoanReferenceRates] as const;

export type { Grounded };
