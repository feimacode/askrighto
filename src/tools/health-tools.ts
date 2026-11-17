/**
 * Private health cover tools (add-health-cover-tools). Facts and calculations only: no ranking, no advice.
 * Income, age and household are call-only values: they are never logged, stored or echoed beyond the result.
 */
import { z } from "zod";
import { inkview, inkviewResult, inkviewSource, tableMeta } from "./energy-common.js";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found, type Grounded } from "../core/grounded.js";
import {
  annualCents,
  dollars,
  estimateLhc,
  estimateRebate,
  estimateSurcharge,
  pctText,
  type NotEstimated,
} from "../health/calc.js";
import { withHealth, withRates } from "../health/index.js";
import {
  CALCULATED_NOTE,
  HEALTH_CAPTION,
  HEALTH_NOTICE,
  PHIO_SOURCE,
  premiumChangeWarning,
  RULES_SOURCE,
} from "../health/notice.js";
import {
  AGE_BANDS,
  ruleAt,
  TIER_CODES,
  todayIso,
  type RatesData,
} from "../health/rules.js";
import {
  COVER_KINDS,
  HOUSEHOLDS,
  categoriesOf,
  COVER_LETTER,
  type CoverState,
  type HealthData,
  type HealthPremium,
  type HealthProduct,
  type Household,
} from "../health/types.js";

const productBase = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["health-cover-products"] as const,
} as const;
const calcBase = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["health-cover-products", "health-cover-rates"] as const,
} as const;
const rulesBase = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["health-cover-rates"] as const,
} as const;

const lower = (s: string | undefined) => (s ?? "").toLowerCase();
const withNotice = (t: string) => `${t}\n\n${HEALTH_NOTICE}`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const CONFIRM = "Confirm price and cover with the insurer before acting.";

const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("Date the calculation is for, YYYY-MM-DD; defaults to today");

function monthlyEquivalent(p: HealthPremium): number {
  return Math.round(annualCents(p) / 12);
}
/** The premium used for ordering and filtering: before the rebate where the file says so, else the first published. */
function headline(p: HealthProduct): HealthPremium | undefined {
  return p.premiums.find((x) => x.basis === "before_rebate") ?? p.premiums[0];
}

export interface HealthView {
  productId: string;
  insurer: string;
  name: string;
  kind: string;
  tier?: string;
  state?: string;
  household?: string;
  excess?: string;
  premiums: string[];
  /** Whether the file says the policy is exempt from the Medicare levy surcharge, when it says. */
  levySurchargeExempt?: boolean;
  /** Who can buy it, from the file: restricted fund, employer group, needs another product. */
  availability: string[];
  categories?: { label: string; cover: string }[];
  waitingPeriods?: string[];
  infoUrl?: string;
}

function premiumText(p: HealthPremium): string {
  const basis =
    p.basis === "before_rebate"
      ? "before rebate"
      : p.basis === "after_rebate"
        ? `after rebate${p.rebateTier ? ` (${p.rebateTier})` : ""}`
        : "rebate basis not stated";
  return `${dollars(p.amountCents)} ${p.frequency} (${basis})`;
}

/** Excess as the file states it, with each published amount named, never reduced to one number. */
function excessText(p: HealthProduct): string | undefined {
  if (p.excessType === undefined) return undefined;
  if (p.excessType === "None") return "none (the file says no excess)";
  const parts = [
    p.excessPerAdmissionCents !== undefined ? `${dollars(p.excessPerAdmissionCents)} per admission` : undefined,
    p.excessPerPersonCents !== undefined ? `${dollars(p.excessPerPersonCents)} per person` : undefined,
    p.excessPerPolicyCents !== undefined ? `${dollars(p.excessPerPolicyCents)} per policy` : undefined,
  ].filter(Boolean);
  return `${parts.join(", ") || "amount not published"} (${p.excessType})`;
}

function availabilityOf(p: HealthProduct, ins: HealthData["insurers"][number] | undefined): string[] {
  const out: string[] = [];
  if (ins?.fundType === "restricted")
    out.push(`restricted fund${ins.restrictionHint ? `: ${ins.restrictionHint}` : ""}`);
  if (p.corporate) out.push("corporate or employer-group product");
  if (p.onlyAvailableWith) out.push(`only available with ${p.onlyAvailableWith}`);
  return out;
}

/** The stated cover for one category title, or undefined when the product does not state it. */
function coverFor(d: HealthData, p: HealthProduct, title: string): CoverState | undefined {
  const i = d.categoryTitles.indexOf(title);
  return i < 0 ? undefined : COVER_LETTER[p.coverCodes[i] ?? ""];
}

/** The household for a threshold: what the user said, else the product's own when it is one of the four types. */
function estHousehold(given: Household | undefined, p: HealthProduct): Household | undefined {
  return given ?? (p.household && p.household !== "dependants_only" ? p.household : undefined);
}

function viewOf(d: HealthData, p: HealthProduct, full: boolean): HealthView {
  const ins = d.insurers.find((i) => i.id === p.insurerId);
  return {
    productId: p.id,
    insurer: ins?.name ?? p.insurerId,
    name: p.name,
    kind: p.kind,
    ...(p.tier ? { tier: p.tier } : {}),
    ...(p.state ? { state: p.state } : {}),
    ...(p.household ? { household: p.household } : {}),
    ...(excessText(p) ? { excess: excessText(p)! } : {}),
    premiums: p.premiums.map(premiumText),
    ...(p.mlsExempt !== undefined ? { levySurchargeExempt: p.mlsExempt } : {}),
    availability: availabilityOf(p, ins),
    ...(full
      ? {
          categories: categoriesOf(d, p).map((c) => ({ label: c.label, cover: c.cover.replace("_", " ") })),
          waitingPeriods: p.waiting.map((w) => `${w.type}: ${w.months} months`),
        }
      : {}),
    ...(p.infoUrl ? { infoUrl: p.infoUrl } : {}),
  };
}

const findProduct = (d: HealthData, id: string) => d.products.find((p) => p.id === id.trim());
const notInDataset = (id: string): Grounded<never> =>
  notFound(
    "not_in_dataset",
    `No product with id "${id}" is in the loaded PHIO file. Use search_health_cover_products to find an id.`,
    { productId: id },
  );

const productResult = <T extends object>(d: HealthData, data: T, warnings: string[] = []): Found<T & { notice: string }> =>
  found({
    data: { ...data, notice: HEALTH_NOTICE },
    source: { ...PHIO_SOURCE },
    asOf: d.sourceDate,
    warnings: [...warnings, ...premiumChangeWarning(d.sourceDate)],
  });

const coverageNote = (d: HealthData) =>
  `Products in the PrivateHealth.gov.au file dated ${isoDay(d.sourceDate)} (${d.insurers.length} insurers, ${d.products.length} product variants loaded). This is not necessarily every fund or the whole market.`;

// ---------------------------------------------------------------- search_health_cover_products
interface SearchData {
  total: number;
  returned: number;
  matchesWithoutPublishedPremium: number;
  coverage: string;
  order: string;
  categoryStates: Record<string, string>[];
  products: HealthView[];
  notes: string[];
  notice: string;
  outcome: string;
}

export const searchHealthCoverProducts = defineTool({
  name: "search_health_cover_products",
  title: "Search private health insurance products",
  description:
    "Finds private health insurance products in the PrivateHealth.gov.au monthly file by state, household type, cover type (hospital, general treatment or combined), hospital tier, clinical categories wanted (by the names the file uses), maximum excess, maximum monthly premium and insurer. Results are ordered only by the sort you choose (premium or excess), with premiums, excess and the stated cover for each category as published. It compares published facts and does not recommend a product or give advice.",
  inputSchema: z.object({
    state: z.string().max(3).optional().describe("State or territory code, e.g. VIC"),
    household: z.enum(HOUSEHOLDS).optional().describe("Who the policy covers"),
    coverType: z.enum(COVER_KINDS).optional().describe("hospital, general_treatment or combined"),
    hospitalTier: z.string().max(30).optional().describe("Hospital tier code as the file words it, e.g. Gold"),
    requiredCategories: z
      .array(z.string().max(80))
      .max(8)
      .optional()
      .describe("Clinical category names wanted, e.g. Pregnancy and birth. Names only, never conditions"),
    maxExcess: z.number().min(0).max(100000).optional().describe("Maximum excess in dollars"),
    maxMonthlyPremium: z
      .number()
      .min(0)
      .max(100000)
      .optional()
      .describe("Maximum monthly premium in dollars, before rebate where the file says so"),
    insurer: z.string().max(80).optional().describe("Insurer name or part of it"),
    sort: z.enum(["premium_asc", "excess_asc"]).optional().describe("Order: premium_asc (default) or excess_asc"),
    limit: z.number().int().min(1).max(50).optional().describe("Products to return, default 20"),
  }),
  ...productBase,
  meta: tableMeta("data_table"),
  handler: (a) =>
    withHealth<SearchData>((d) => {
      let list = [...d.products];
      if (a.state) list = list.filter((p) => !p.state || p.state.toLowerCase() === a.state!.toLowerCase());
      if (a.household) list = list.filter((p) => !p.household || p.household === a.household);
      if (a.coverType) list = list.filter((p) => p.kind === a.coverType);
      if (a.hospitalTier) list = list.filter((p) => lower(p.tier) === lower(a.hospitalTier));
      if (a.insurer) {
        const w = lower(a.insurer);
        list = list.filter((p) => lower(d.insurers.find((i) => i.id === p.insurerId)?.name).includes(w));
      }
      if (a.maxExcess !== undefined)
        list = list.filter((p) => p.excessCents !== undefined && p.excessCents <= Math.round(a.maxExcess! * 100));
      const notes: string[] = [];
      const wantedLabels: string[] = [];
      for (const want of a.requiredCategories ?? []) {
        const known = new Set(d.categoryTitles);
        const squash = (x: string) => lower(x).replace(/[^a-z0-9]/g, "");
        const label =
          [...known].find((k) => squash(k) === squash(want)) ?? [...known].find((k) => squash(k).includes(squash(want)));
        if (!label)
          return notFound(
            "needs_input",
            `"${want}" is not a clinical category name in the loaded file. Use one of the category names listed in the details.`,
            { categories: [...known].sort().slice(0, 80) },
          );
        wantedLabels.push(label);
        list = list.filter((p) => {
          const c = coverFor(d, p, label);
          return c !== undefined && c !== "not_covered";
        });
      }
      if (wantedLabels.length)
        notes.push(
          "Products shown cover or partly cover (restricted) every category asked for; the stated cover for each is listed.",
        );
      let withoutPremium = list.filter((p) => p.premiums.length === 0).length;
      if (a.maxMonthlyPremium !== undefined) {
        const cap = Math.round(a.maxMonthlyPremium * 100);
        withoutPremium = list.filter((p) => !headline(p)).length;
        list = list.filter((p) => {
          const h = headline(p);
          return h !== undefined && monthlyEquivalent(h) <= cap;
        });
        notes.push(
          `Only products with a published premium at or below ${dollars(cap)} a month are shown; ${withoutPremium} other matching product(s) have no published premium and are not counted.`,
        );
      }
      if (list.length === 0)
        return notFound(
          "not_in_dataset",
          "No product in the loaded file matches those filters. Try fewer filters. No product is suggested.",
          { filters: { state: a.state, household: a.household, coverType: a.coverType, hospitalTier: a.hospitalTier } },
        );
      const sort = a.sort ?? "premium_asc";
      list.sort((x, y) => {
        const key =
          sort === "excess_asc"
            ? (x.excessCents ?? Infinity) - (y.excessCents ?? Infinity)
            : (headline(x) ? monthlyEquivalent(headline(x)!) : Infinity) -
              (headline(y) ? monthlyEquivalent(headline(y)!) : Infinity);
        return (Number.isNaN(key) ? 0 : key) || x.id.localeCompare(y.id);
      });
      const page = list.slice(0, a.limit ?? 20);
      return productResult(d, {
        total: list.length,
        returned: page.length,
        matchesWithoutPublishedPremium: withoutPremium,
        coverage: coverageNote(d),
        order: sort === "excess_asc" ? "lowest excess first" : "lowest premium first",
        categoryStates: page.map((p) =>
          Object.fromEntries(
            wantedLabels.map((l) => [l, coverFor(d, p, l)?.replace("_", " ") ?? "not stated"]),
          ),
        ),
        products: page.map((p) => viewOf(d, p, false)),
        notes,
        outcome: "results",
      }) as unknown as Found<SearchData>;
    }),
  render: (d) =>
    withNotice(
      [
        `${d.returned} of ${d.total} matching products, ${d.order}. ${d.matchesWithoutPublishedPremium} matching products have no published premium. ${d.coverage}`,
        ...d.notes,
        ...d.products.map(
          (p, i) =>
            `- ${p.insurer}, ${p.name} (${p.kind}${p.tier ? `, ${p.tier}` : ""}${p.state ? `, ${p.state}` : ""}${p.household ? `, ${p.household}` : ""}). Product id ${p.productId}. ${p.premiums.length ? `Premium: ${p.premiums.join("; ")}. ` : "Premium not published. "}${p.excess ? `Excess ${p.excess}. ` : "Excess not published. "}${Object.entries(d.categoryStates[i] ?? {})
              .map(([k, v]) => `${k}: ${v}.`)
              .join(" ")}`,
        ),
        CONFIRM,
      ].join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<SearchData>;
      return inkview.table(
        {
          title: "Private health insurance products",
          caption: HEALTH_CAPTION,
          columns: [
            { key: "insurer", label: "Insurer" },
            { key: "product", label: "Product" },
            { key: "tier", label: "Tier" },
            { key: "excess", label: "Excess" },
            { key: "premium", label: "Premium (as published)" },
          ],
          rows: r.data.products.map((p) => ({
            insurer: p.insurer,
            product: p.name,
            tier: p.tier ?? "Not published",
            excess: p.excess ?? "Not published",
            premium: p.premiums[0] ?? "Not published",
          })),
          source: inkviewSource(r),
        },
        { limit: 50 },
      );
    }),
});

// ---------------------------------------------------------------- get_health_cover_product
export const getHealthCoverProduct = defineTool({
  name: "get_health_cover_product",
  title: "Show one private health insurance product",
  description:
    "Shows one product variant from the PrivateHealth.gov.au file: insurer, cover type, tier, state, household, excess, every published premium with its rebate basis, the stated cover for every clinical category, waiting periods and the insurer's information statement link when the file carries one. Use a product id from search_health_cover_products.",
  inputSchema: z.object({
    productId: z.string().max(200).describe("Product id from search_health_cover_products"),
  }),
  ...productBase,
  handler: (a) =>
    withHealth<HealthView & { notice: string; outcome: string; coverage: string }>((d) => {
      const p = findProduct(d, a.productId);
      if (!p) return notInDataset(a.productId);
      return productResult(d, {
        ...viewOf(d, p, true),
        coverage: coverageNote(d),
        outcome: p.premiums.length ? "complete" : "partial",
      }) as unknown as Found<HealthView & { notice: string; outcome: string; coverage: string }>;
    }),
  render: (v) =>
    withNotice(
      [
        `${v.insurer}, ${v.name}. Product id ${v.productId}. Cover type: ${v.kind}.${v.tier ? ` Tier: ${v.tier}.` : ""}${v.state ? ` State: ${v.state}.` : ""}${v.household ? ` Household: ${v.household}.` : ""}`,
        v.excess ? `Excess: ${v.excess}.` : "Excess: not published.",
        v.premiums.length ? `Premiums as published: ${v.premiums.join("; ")}.` : "Premium: not published.",
        v.levySurchargeExempt !== undefined
          ? `Medicare levy surcharge exempt, as the file states: ${v.levySurchargeExempt ? "yes" : "no"}.`
          : "Medicare levy surcharge exemption: not stated in the file.",
        v.availability.length ? `Who can buy it: ${v.availability.join("; ")}.` : "",
        v.categories?.length
          ? `Clinical categories: ${v.categories.map((c) => `${c.label} (${c.cover})`).join(", ")}.`
          : "Clinical categories: not published.",
        v.waitingPeriods?.length ? `Waiting periods: ${v.waitingPeriods.join("; ")}.` : "Waiting periods: not published.",
        v.infoUrl ? `Insurer's page for this product: ${v.infoUrl}` : "No insurer page link is in the file for this product.",
        v.coverage,
        CONFIRM,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
});

// ---------------------------------------------------------------- compare_health_cover_products
interface CompareData {
  products: HealthView[];
  notice: string;
}
const CMP = ["Insurer", "Cover type", "Tier", "Excess", "Premium (as published)", "Categories not covered"];
const cmpCell = (v: HealthView, i: number): string =>
  [
    v.insurer,
    v.kind,
    v.tier ?? "Not published",
    v.excess ?? "Not published",
    v.premiums.join("; ") || "Not published",
    v.categories?.filter((c) => c.cover === "not covered").map((c) => c.label).join(", ") || "None listed",
  ][i]!;

export const compareHealthCoverProducts = defineTool({
  name: "compare_health_cover_products",
  title: "Compare private health insurance products",
  description:
    "Shows two to four product variants from the PrivateHealth.gov.au file side by side on the same published fields: insurer, cover type, tier, excess, premiums and categories not covered. It shows differences and does not judge them or pick one.",
  inputSchema: z.object({
    productIds: z.array(z.string().max(200)).min(1).max(8).describe("Two to four product ids from search_health_cover_products"),
  }),
  ...productBase,
  meta: tableMeta("comparison"),
  handler: (a) =>
    withHealth<CompareData>((d) => {
      if (a.productIds.length < 2 || a.productIds.length > 4)
        return notFound("needs_input", "Compare two to four products; at most four can be compared at once.");
      const views: HealthView[] = [];
      for (const id of a.productIds) {
        const p = findProduct(d, id);
        if (!p) return notInDataset(id);
        views.push(viewOf(d, p, true));
      }
      return productResult(d, { products: views }) as unknown as Found<CompareData>;
    }),
  render: (d) =>
    withNotice(
      [
        `| | ${d.products.map((p) => `${p.name} (${p.productId})`).join(" | ")} |`,
        `|---|${d.products.map(() => "---").join("|")}|`,
        ...CMP.map((label, i) => `| ${label} | ${d.products.map((p) => cmpCell(p, i).replace(/\|/g, "/")).join(" | ")} |`),
        CONFIRM,
      ].join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CompareData>;
      return inkview.comparison({
        title: "Product comparison (differences shown, none picked)",
        items: r.data.products.map((p) => ({ name: p.name.slice(0, 80), subtitle: p.insurer.slice(0, 120) })),
        criteria: CMP,
        values: r.data.products.map((p) => CMP.map((_, i) => cmpCell(p, i).slice(0, 200))),
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- calculations
const rulesSourceOf = (iso: string) => ({ source: { ...RULES_SOURCE }, asOf: new Date(`${iso}T00:00:00Z`) });
const notEstimated = (n: NotEstimated): Grounded<never> =>
  notFound("outside_coverage", n.message, {
    calcReason: n.reason,
    ...(n.proposed
      ? {
          proposedChange: `A change is proposed from that date and is not law (${n.proposed.note ?? ""}). See ${n.proposed.sourceUrl}`,
        }
      : {}),
  });
const todayOr = (d?: string) => d ?? todayIso();

interface PremiumData {
  product: HealthView;
  asAt: string;
  tier: string;
  ageBand: string;
  rebatePercent: string;
  premiumBeforeRebateAnnual: string;
  premiumAfterRebateAnnual: string;
  premiumAfterRebateMonthly: string;
  basis: string;
  label: string;
  ruleEffective: string;
  ruleSourceUrl: string;
  productDataAsOf: string;
  notice: string;
  outcome: string;
}

export const estimatePremiumAfterRebate = defineTool({
  name: "estimate_premium_after_rebate",
  title: "Estimate a premium after the government rebate",
  description:
    "For one product variant, shows the published premium and the premium after the Australian Government rebate for an income tier (or an income and household) and an age band, using the ATO rates in force on a date. If the file already states a premium after that tier it is shown as published; otherwise it is calculated and labelled. Returns an explicit not-estimated answer when the rates for the date are not held, a change is only proposed, or the file does not say whether a premium is before or after rebate. Income is used for this call only and is not stored.",
  inputSchema: z.object({
    productId: z.string().max(200).describe("Product id from search_health_cover_products"),
    ageBand: z.enum(AGE_BANDS).describe("Age of the oldest person covered: under65, age65to69 or age70plus"),
    incomeTier: z.enum(TIER_CODES).optional().describe("Rebate income tier if known: base, tier1, tier2 or tier3"),
    income: z.number().min(0).max(10_000_000).optional().describe("Income for surcharge purposes in dollars, if no tier is given; not stored"),
    household: z.enum(HOUSEHOLDS).optional().describe("Household type, needed with an income"),
    dependentChildren: z.number().int().min(0).max(20).optional().describe("Dependent children, for family thresholds"),
    asAt: dateArg,
  }),
  ...calcBase,
  handler: (a) =>
    withHealth<PremiumData>((d, rates) => {
      const p = findProduct(d, a.productId);
      if (!p) return notInDataset(a.productId);
      const date = todayOr(a.asAt);
      const est = estimateRebate(
        rates,
        p,
        {
          ageBand: a.ageBand,
          ...(a.incomeTier ? { incomeTier: a.incomeTier } : {}),
          ...(a.income !== undefined ? { income: a.income } : {}),
          ...(estHousehold(a.household, p) ? { household: estHousehold(a.household, p)! } : {}),
          ...(a.dependentChildren !== undefined ? { dependentChildren: a.dependentChildren } : {}),
        },
        date,
      );
      if (!est.estimated) return notEstimated(est);
      const monthly = Math.round(est.premiumAfterAnnualCents / 12);
      const label = est.afterBasis === "published" ? "as published in the file" : `calculated: ${CALCULATED_NOTE}`;
      return found({
        data: {
          product: viewOf(d, p, false),
          asAt: date,
          tier: est.tier,
          ageBand: a.ageBand,
          rebatePercent: pctText(est.rebatePercentMilli),
          premiumBeforeRebateAnnual: dollars(est.premiumBeforeAnnualCents),
          premiumAfterRebateAnnual: dollars(est.premiumAfterAnnualCents),
          premiumAfterRebateMonthly: dollars(monthly),
          basis: est.afterBasis,
          label,
          ruleEffective: `${est.ruleFrom} to ${est.ruleTo ?? "open"}`,
          ruleSourceUrl: est.sourceUrl,
          productDataAsOf: isoDay(d.sourceDate),
          notice: HEALTH_NOTICE,
          outcome: est.afterBasis,
        },
        ...rulesSourceOf(est.sourceUpdatedOn),
        warnings: [`Product premium is from the PHIO file dated ${isoDay(d.sourceDate)}.`, ...premiumChangeWarning(d.sourceDate)],
      }) as Found<PremiumData>;
    }),
  render: (v) =>
    withNotice(
      [
        `${v.product.insurer}, ${v.product.name} (${v.product.productId}), for ${v.asAt}.`,
        `Rebate tier ${v.tier}, age band ${v.ageBand}: rebate ${v.rebatePercent} (rates effective ${v.ruleEffective}).`,
        `Yearly premium before rebate: ${v.premiumBeforeRebateAnnual}.`,
        `Yearly premium after rebate: ${v.premiumAfterRebateAnnual} (about ${v.premiumAfterRebateMonthly} a month) (${v.label}).`,
        `Product data is from the PHIO file dated ${v.productDataAsOf}. Rates: ${v.ruleSourceUrl}.`,
        CONFIRM,
      ].join("\n"),
    ),
});

interface SurchargeData {
  product: HealthView;
  asAt: string;
  surchargeTier: string;
  surchargeRate: string;
  surchargeAnnual: string;
  premiumAfterRebateAnnual: string;
  premiumBasis: string;
  difference: string;
  lowerOf: string;
  exemptionCondition: string;
  ruleSourceUrl: string;
  productDataAsOf: string;
  label: string;
  notice: string;
  outcome: string;
}

export const checkLevySurchargeBreakeven = defineTool({
  name: "check_levy_surcharge_breakeven",
  title: "Compare the Medicare levy surcharge with a premium after rebate",
  description:
    "For one hospital or combined product variant and an income, shows two yearly figures side by side: the Medicare levy surcharge for that income (ATO rates in force on a date) and the product's premium after the rebate, with the difference and which is lower. It states the condition for the exemption and links the ATO. It shows figures only: it does not say whether to buy, keep or drop cover. Income is used for this call only and is not stored.",
  inputSchema: z.object({
    productId: z.string().max(200).describe("Product id from search_health_cover_products (hospital or combined)"),
    income: z.number().min(0).max(10_000_000).describe("Income for Medicare levy surcharge purposes in dollars (family income for couples and families); not stored"),
    household: z.enum(HOUSEHOLDS).describe("Household type"),
    ageBand: z.enum(AGE_BANDS).describe("Age of the oldest person covered"),
    dependentChildren: z.number().int().min(0).max(20).optional().describe("Dependent children"),
    asAt: dateArg,
  }),
  ...calcBase,
  handler: (a) =>
    withHealth<SurchargeData>((d, rates) => {
      const p = findProduct(d, a.productId);
      if (!p) return notInDataset(a.productId);
      if (p.kind === "general_treatment")
        return notFound(
          "needs_input",
          "The surcharge test concerns hospital cover. Choose a hospital or combined product.",
        );
      const date = todayOr(a.asAt);
      const sur = estimateSurcharge(
        rates,
        { income: a.income, household: a.household, ...(a.dependentChildren !== undefined ? { dependentChildren: a.dependentChildren } : {}) },
        date,
      );
      if (!sur.estimated) return notEstimated(sur);
      const reb = estimateRebate(
        rates,
        p,
        {
          ageBand: a.ageBand,
          income: a.income,
          household: a.household,
          ...(a.dependentChildren !== undefined ? { dependentChildren: a.dependentChildren } : {}),
        },
        date,
      );
      if (!reb.estimated) return notEstimated(reb);
      const diff = reb.premiumAfterAnnualCents - sur.surchargeCents;
      return found({
        data: {
          product: viewOf(d, p, false),
          asAt: date,
          surchargeTier: sur.tier,
          surchargeRate: pctText(sur.ratePercentMilli),
          surchargeAnnual: dollars(sur.surchargeCents),
          premiumAfterRebateAnnual: dollars(reb.premiumAfterAnnualCents),
          premiumBasis: reb.afterBasis,
          difference: dollars(Math.abs(diff)),
          lowerOf:
            diff === 0
              ? "the two yearly figures are equal"
              : diff > 0
                ? "the surcharge is the lower yearly figure"
                : "the premium after rebate is the lower yearly figure",
          exemptionCondition:
            "The surcharge is avoided only by hospital cover that meets the ATO's conditions, including an excess no higher than the ATO's limit. Ask Righto does not check eligibility; see the ATO page.",
          ruleSourceUrl: sur.sourceUrl,
          productDataAsOf: isoDay(d.sourceDate),
          label: reb.afterBasis === "published" ? "premium as published" : `calculated: ${CALCULATED_NOTE}`,
          notice: HEALTH_NOTICE,
          outcome: "compared",
        },
        ...rulesSourceOf(sur.sourceUpdatedOn),
        warnings: [`Product premium is from the PHIO file dated ${isoDay(d.sourceDate)}.`, ...premiumChangeWarning(d.sourceDate)],
      }) as Found<SurchargeData>;
    }),
  render: (v) =>
    withNotice(
      [
        `${v.product.insurer}, ${v.product.name} (${v.product.productId}), for ${v.asAt}.`,
        `Medicare levy surcharge for this income (${v.surchargeTier}, ${v.surchargeRate}): ${v.surchargeAnnual} a year.`,
        `Premium after rebate: ${v.premiumAfterRebateAnnual} a year (${v.label}).`,
        `Difference: ${v.difference}; ${v.lowerOf}.`,
        v.exemptionCondition,
        `The ATO's own calculator and your insurer's quote govern. Rates: ${v.ruleSourceUrl}. Product data is from the PHIO file dated ${v.productDataAsOf}.`,
        "These are figures, not a view on whether to hold cover.",
      ].join("\n"),
    ),
});

interface LhcData {
  asAt: string;
  loadingPercent: number;
  removed: boolean;
  yearsOver30: number;
  rule: string;
  hospitalComponentNote: string;
  ruleSourceUrl: string;
  notice: string;
  outcome: string;
}

export const estimateLifetimeHealthCoverLoading = defineTool({
  name: "estimate_lifetime_health_cover_loading",
  title: "Estimate the Lifetime Health Cover loading",
  description:
    "Works out the Lifetime Health Cover loading percentage from the age someone first took hospital cover and the years of continuous cover, using the ATO rule stored by Ask Righto (2 per cent for each year over 30, capped, removed after ten years of continuous paid cover). Returns an explicit not-estimated answer for cases the ATO says change the base day. It gives a percentage only: it does not multiply a premium, since the loading applies to the hospital component. Nothing is stored.",
  inputSchema: z.object({
    ageAtFirstHospitalCover: z.number().int().min(0).max(120).describe("Age in whole years when hospital cover first started"),
    yearsOfContinuousCover: z.number().int().min(0).max(100).optional().describe("Years of continuous paid hospital cover so far"),
    unusualCircumstances: z
      .boolean()
      .optional()
      .describe("True if the person was overseas on their base day, arrived after 30, or has an unusual history"),
    asAt: dateArg,
  }),
  ...rulesBase,
  handler: (a) =>
    withRates<LhcData>((rates) => {
      const date = todayOr(a.asAt);
      const r = estimateLhc(
        rates,
        {
          ageAtFirstHospitalCover: a.ageAtFirstHospitalCover,
          ...(a.yearsOfContinuousCover !== undefined ? { yearsOfContinuousCover: a.yearsOfContinuousCover } : {}),
          ...(a.unusualCircumstances ? { unusualCircumstances: true } : {}),
        },
        date,
      );
      if (!r.estimated) return notEstimated(r);
      return found({
        data: {
          asAt: date,
          loadingPercent: r.loadingPercent,
          removed: r.removed,
          yearsOver30: r.yearsOver30,
          rule: "2 per cent for each year over 30, up to the cap, ending after ten years of continuous paid cover (stored rule; see source)",
          hospitalComponentNote:
            "The loading applies to the hospital part of a premium. Ask Righto does not apply it to a combined premium; ask the insurer for your loaded premium.",
          ruleSourceUrl: r.sourceUrl,
          notice: HEALTH_NOTICE,
          outcome: "estimated",
        },
        ...rulesSourceOf(r.sourceUpdatedOn),
      }) as Found<LhcData>;
    }),
  render: (v) =>
    withNotice(
      [
        `For ${v.asAt}: loading ${v.loadingPercent}%${v.removed ? " (removed: ten years of continuous cover reached)" : ""}, from ${v.yearsOver30} year(s) over 30 (calculated: ${CALCULATED_NOTE}).`,
        v.rule,
        v.hospitalComponentNote,
        `ATO source: ${v.ruleSourceUrl}.`,
      ].join("\n"),
    ),
});

interface RulesData {
  asAt: string;
  rebate: { effective: string; status: string; thresholds: unknown; percents: unknown; sourceUrl: string; pageUpdatedOn: string } | null;
  surcharge: { effective: string; status: string; thresholds: unknown; ratePercents: number[]; sourceUrl: string; pageUpdatedOn: string } | null;
  lhc: { percentPerYearOver: number; startAge: number; capPercent: number; yearsToRemove: number; sourceUrl: string; pageUpdatedOn: string } | null;
  proposedChanges: { id: string; effective: string; note: string; sourceUrl: string }[];
  notice: string;
  outcome: string;
}

const proposedList = (rates: RatesData, date: string) =>
  rates.rebate
    .filter((r) => r.status === "proposed" && r.effectiveTo !== undefined && r.effectiveTo >= date)
    .map((r) => ({
      id: r.id,
      effective: `${r.effectiveFrom} to ${r.effectiveTo ?? "open"}`,
      note: r.note ?? "Proposed and not law.",
      sourceUrl: r.source.url,
    }));

export const getHealthCoverRules = defineTool({
  name: "get_health_cover_rules",
  title: "Show the health cover rebate, surcharge and loading rules",
  description:
    "Shows the rebate income tiers and percentages by age band, the Medicare levy surcharge tiers and rates, and the Lifetime Health Cover rule in force on a date, each with its ATO source link, the page's updated date and effective dates. A change that is only proposed is listed separately and marked not law. Use it to answer 'what are the thresholds' without working anything out.",
  inputSchema: z.object({ asAt: dateArg }),
  ...rulesBase,
  handler: (a) =>
    withRates<RulesData>((rates) => {
      const date = todayOr(a.asAt);
      const reb = ruleAt(rates.rebate, date);
      const mls = ruleAt(rates.mls, date);
      if (!reb && !mls)
        return notFound(
          "outside_coverage",
          `Ask Righto holds no rebate or surcharge rules in force for ${date}.`,
          { calcReason: "rules_out_of_range", proposed: proposedList(rates, date) },
        );
      const lhc = ruleAt(rates.lhc, date);
      const newest = [reb?.source.pageUpdatedOn, mls?.source.pageUpdatedOn, lhc?.source.pageUpdatedOn].filter(Boolean).sort().pop()!;
      return found({
        data: {
          asAt: date,
          rebate: reb
            ? {
                effective: `${reb.effectiveFrom} to ${reb.effectiveTo ?? "open"}`,
                status: reb.status,
                thresholds: reb.thresholds,
                percents: reb.percents,
                sourceUrl: reb.source.url,
                pageUpdatedOn: reb.source.pageUpdatedOn,
              }
            : null,
          surcharge: mls
            ? {
                effective: `${mls.effectiveFrom} to ${mls.effectiveTo ?? "open"}`,
                status: mls.status,
                thresholds: mls.thresholds,
                ratePercents: mls.ratePercents,
                sourceUrl: mls.source.url,
                pageUpdatedOn: mls.source.pageUpdatedOn,
              }
            : null,
          lhc: lhc
            ? {
                percentPerYearOver: lhc.percentPerYearOver,
                startAge: lhc.startAge,
                capPercent: lhc.capPercent,
                yearsToRemove: lhc.yearsToRemove,
                sourceUrl: lhc.source.url,
                pageUpdatedOn: lhc.source.pageUpdatedOn,
              }
            : null,
          proposedChanges: proposedList(rates, date),
          notice: HEALTH_NOTICE,
          outcome: "rules",
        },
        ...rulesSourceOf(newest),
        warnings: [],
      }) as Found<RulesData>;
    }),
  render: (v) =>
    withNotice(
      [
        `Rules in force on ${v.asAt}.`,
        v.rebate
          ? `Rebate (${v.rebate.status}, ${v.rebate.effective}): thresholds ${JSON.stringify(v.rebate.thresholds)} (top of base, tier 1, tier 2); percentages by age band ${JSON.stringify(v.rebate.percents)}. Source ${v.rebate.sourceUrl}, page updated ${v.rebate.pageUpdatedOn}.`
          : "No rebate rule is in force for that date.",
        v.surcharge
          ? `Medicare levy surcharge (${v.surcharge.status}, ${v.surcharge.effective}): thresholds ${JSON.stringify(v.surcharge.thresholds)}; rates ${v.surcharge.ratePercents.join(", ")} per cent for base to tier 3. Source ${v.surcharge.sourceUrl}, page updated ${v.surcharge.pageUpdatedOn}.`
          : "No surcharge rule is in force for that date.",
        v.lhc
          ? `Lifetime Health Cover: ${v.lhc.percentPerYearOver}% for each year over ${v.lhc.startAge}, capped at ${v.lhc.capPercent}%, ending after ${v.lhc.yearsToRemove} years of continuous paid cover. Source ${v.lhc.sourceUrl}, page updated ${v.lhc.pageUpdatedOn}.`
          : "",
        ...v.proposedChanges.map((p) => `PROPOSED, NOT LAW (${p.effective}): ${p.note} Source ${p.sourceUrl}. No figure is calculated from it.`),
        "Family thresholds rise by $1,500 for each dependent child after the first.",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
});

export const HEALTH_TOOLS = [
  searchHealthCoverProducts,
  getHealthCoverProduct,
  compareHealthCoverProducts,
  estimatePremiumAfterRebate,
  checkLevySurchargeBreakeven,
  estimateLifetimeHealthCoverLoading,
  getHealthCoverRules,
] as const;
