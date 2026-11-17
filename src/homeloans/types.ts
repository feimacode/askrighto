/** Normalised home loan model. Rates and fees are kept exactly as the lender published them. */
export type LoanRateType =
  | "VARIABLE"
  | "FIXED"
  | "INTRODUCTORY"
  | "DISCOUNT"
  | "BUNDLE_DISCOUNT_FIXED"
  | "BUNDLE_DISCOUNT_VARIABLE"
  | "OTHER";
export type LoanPurpose = "OWNER_OCCUPIED" | "INVESTMENT" | "OTHER" | "UNCONSTRAINED";
export type LoanRepayment = "PRINCIPAL_AND_INTEREST" | "INTEREST_ONLY" | "OTHER" | "UNCONSTRAINED";

export interface RateTier {
  unit: "PERCENT_LVR" | "DOLLAR" | "MONTH" | "DAY";
  /** As published (a fraction string for LVR, so "0.8" is 80%). */
  min: string;
  max?: string;
  method?: string;
  name?: string;
}

export interface LoanRate {
  type: LoanRateType;
  /** The type exactly as the lender sent it. */
  rawType: string;
  /** As published, a fraction string: "0.0599" is 5.99%. */
  rate: string;
  /** The same rate as a percentage number, for sorting and arithmetic only. */
  ratePct: number;
  comparisonRate?: string;
  comparisonRatePct?: number;
  purpose: LoanPurpose;
  repayment: LoanRepayment;
  /** Months, read from `additionalValue` when the type is FIXED. */
  fixedTermMonths?: number;
  tiers: RateTier[];
  /** Conditions and notes the lender attached, verbatim. */
  conditions: string[];
}

export interface LoanFee {
  name: string;
  feeType: string;
  method: "fixedAmount" | "rateBased" | "variable" | "unknown";
  /** Dollar amount string as published (fixed amount fees). */
  amount?: string;
  /** Rate string as published (rate based fees). */
  rate?: string;
  rateType?: string;
  note?: string;
  discounts: number;
}

export interface LoanConstraint {
  type: string;
  value?: string;
  note?: string;
}

export interface HomeLoanProduct {
  lenderSlug: string;
  productId: string;
  brandName: string;
  name: string;
  description: string;
  isTailored: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  rates: LoanRate[];
  fees: LoanFee[];
  features: Array<{ type: string; note?: string }>;
  constraints: LoanConstraint[];
  eligibility: string[];
  links: { product?: string; apply?: string; feesAndPricing?: string; eligibility?: string; terms?: string };
  understood: boolean;
  notUnderstood: string[];
  sourceLastUpdated: string;
  fetchedAt: string;
  verifiedAt: string;
  detailHash: string;
}

export interface Lender {
  slug: string;
  brandName: string;
  /** Public base URI of the lender's CDR endpoints, without `/cds-au/...`. */
  baseUri: string;
  active: boolean;
}

export interface LenderStatus extends Lender {
  lastSyncAt?: Date;
  lastSyncOk?: boolean;
  lastProductCount?: number;
  lastError?: string;
}

export interface CashRate {
  effectiveDate: string;
  valuePct: number;
  sourceUrl: string;
  fetchedAt: Date;
}

export interface HomeLoanData {
  lenders: LenderStatus[];
  products: HomeLoanProduct[];
  cashRate?: CashRate;
  /** Oldest verified_at across stored products, or the last successful lender sync. */
  lastVerified?: Date;
  loadedAt: Date;
}
