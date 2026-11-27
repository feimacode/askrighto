/**
 * Agent guide for reading home loan product data from lenders' Consumer Data Right (CDR) endpoints.
 * Index-only (switch-to-index-only): Ask Righto stores no lender data. This file holds where to read, the object
 * structure, and quirks seen in a real run of 12 lenders on 17 Nov 2026, all in our own words.
 */
export const JOURNEYS = ["find", "read_product", "compare", "all"] as const;
export type Journey = (typeof JOURNEYS)[number];

export interface GuideSection {
  journey: Exclude<Journey, "all">;
  title: string;
  steps: string[];
}

export const CDR_LINKS = {
  cdrSite: "https://www.cdr.gov.au/",
  register: "https://www.cdr.gov.au/find-a-provider",
  brandsApi:
    "https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary",
  schemas: "https://github.com/ConsumerDataStandardsAustralia/dsb-schema-tools",
  standards: "https://consumerdatastandardsaustralia.github.io/standards/",
} as const;

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    journey: "find",
    title: "Find the lenders and their product endpoints",
    steps: [
      "Easiest route: call list_home_loan_lenders, then get_home_loan_products with a lender (and a productId for one product's full detail). Ask Righto relays the lender's own answer live, sets the version headers for you and stores nothing. Use the steps below only if those tools are unavailable.",
      `The CDR Register lists every data holder brand. Its brand summary API (${CDR_LINKS.brandsApi}, send header x-v: 2) gave each brand's publicBaseUri in a 17 Nov 2026 test. Confirm the path against the Register standards on first use.`,
      "A lender's product list is GET {publicBaseUri}/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES, with no login. Follow links.next while it is present.",
      "Each request needs an x-v header (the version). Try x-v 5 for the list; if the lender answers 406 try 4, then 3. Product detail GET {publicBaseUri}/cds-au/v1/banking/products/{productId} worked with x-v 7 on every lender tested. Send x-min-v: 1.",
      "Be gentle: a couple of requests a second per lender at most.",
      "If you cannot set request headers, say so and give the user the lender's own home loan page instead.",
    ],
  },
  {
    journey: "read_product",
    title: "Read one product's object",
    steps: [
      "List item (BankingProduct): productId, name, brand, description, productCategory, lastUpdated, and a link to the lender's product page (applicationUri or additionalInformation.overviewUri).",
      "Detail (BankingProductDetail) adds lendingRates, fees, features, constraints, eligibility, depositRates (not used for loans), and bundles.",
      "lendingRates items: lendingRateType (VARIABLE, FIXED, INTRODUCTORY, DISCOUNT, BUNDLE_DISCOUNT_FIXED, BUNDLE_DISCOUNT_VARIABLE and others), rate and comparisonRate as fraction strings (0.0599 means 5.99%), loanPurpose, repaymentType, applicationFrequency, tiers, additionalValue (a term like P2Y for fixed), additionalInfo.",
      "tiers items: name, unitOfMeasure (PERCENT for LVR, DOLLAR, MONTH, DAY), minimumValue, maximumValue and an optional rateApplicationMethod. Bounds arrived as strings for most lenders and as JSON numbers for one.",
      "fees items: name, feeType, amount or balanceRate or transactionRate, and an additionalValue; read the fee period from the term, not the name.",
      "features items include OFFSET, REDRAW, EXTRA_REPAYMENTS and others, each with featureType and additionalInfo.",
      "Full schemas: dsb-schema-tools, version 1.35.0 at the time of writing (see the schemas link).",
    ],
  },
  {
    journey: "compare",
    title: "Compare products fairly",
    steps: [
      "Compare like with like: same loanPurpose (owner-occupier or investment), same repaymentType, same rate type and fixed term, and the tier that covers the user's own LVR (use the figure the user gives, never estimate it).",
      "A DISCOUNT type rate is a margin taken off another rate (for example 0.0005), not a rate on its own. Never present it as a rate.",
      "A lender can publish a minimum and a maximum advertised rate for the same product and LVR band; show both with their labels.",
      "Rates may carry 16 decimal places; round for display only, and show the lender's own digits if asked.",
      "A comparison rate is the lender's figure for a stated example loan (a fixed amount and term) and includes some fees, not all costs. Never work one out and never say a lower one means a cheaper loan. One lender published a comparison rate lower than its own rate: flag it and quote both.",
      "Quote each figure with the lender, the product link, the endpoint, and the time you fetched it, and say you read it from the lender, not from Ask Righto's data.",
      "State which lenders you covered; it is not the whole market. Never rank by suitability, never say best, cheapest overall or recommended.",
    ],
  },
] as const;

export const GUIDE_RULES = [
  "General information, not credit advice. Do not assess whether the user would be approved or how much they could borrow, do not advise on refinancing or switching, and do not help with an application. Point to the lender or a licensed broker.",
  "Ask only about the loan (owner-occupier or investor, repayment type, fixed or variable and term, the user's own LVR, features wanted). Do not ask for income, employer, identity, address or credit history.",
  "Never send what you fetched back to an Ask Righto tool, and never use it to fill a gap from memory. If a lender will not answer, say so and give the lender's page.",
  "Use calculate_home_loan_repayments for any repayment figure; do not do the arithmetic yourself.",
] as const;
