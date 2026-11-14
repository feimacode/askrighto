/**
 * Normalised energy plan model. Money fields are integers in hundred-thousandths of a dollar
 * (see money.ts). The original decimal strings stay in the stored raw payload.
 */
export type FuelType = "ELECTRICITY" | "GAS" | "DUAL";
export type PlanType = "STANDING" | "MARKET" | "REGULATED";
export type GstBasis = "EXCLUSIVE" | "INCLUSIVE" | "UNKNOWN";

export interface Rate {
  /** Price per measure unit, scaled integer. */
  unitPrice: number;
  /** Source unit, e.g. KWH, MJ, DAY. */
  measureUnit: string;
  /** Block threshold in the measure unit; absent for the last (or only) block. */
  volume?: number;
  /** Period the block threshold applies to, e.g. P1D, P1M. */
  period?: string;
}

export interface TimeWindow {
  days: string[];
  startTime?: string;
  endTime?: string;
}

export interface TimeOfUseRate {
  type: string; // PEAK, OFF_PEAK, SHOULDER, SHOULDER1, SHOULDER2, ...
  displayName?: string;
  rates: Rate[];
  windows: TimeWindow[];
}

export interface TariffPeriod {
  displayName?: string;
  startDate?: string; // MM-DD
  endDate?: string;
  /** Daily supply charge, scaled integer dollars per day. */
  dailySupplyCharge?: number;
  singleRate?: Rate[];
  timeOfUse?: TimeOfUseRate[];
  hasDemandCharges: boolean;
}

export interface ControlledLoad {
  displayName?: string;
  dailySupplyCharge?: number;
  singleRate?: Rate[];
  timeOfUse?: TimeOfUseRate[];
}

export interface FeedIn {
  displayName?: string;
  scheme?: string;
  payerType?: string;
  rates: Rate[];
  timeVarying: boolean;
}

export interface Discount {
  displayName?: string;
  description?: string;
  type?: string; // CONDITIONAL, GUARANTEED, OTHER
  category?: string;
  method?: string; // percentOfBill, percentOfUse, fixedAmount, percentOverThreshold
  /** Percent as a decimal string, or scaled dollars for fixedAmount (see `amountUnit`). */
  percent?: string;
  amount?: number;
  conditional: boolean;
}

export interface Fee {
  type?: string;
  term?: string;
  amount?: number;
  rate?: string;
  description?: string;
}

export interface Incentive {
  displayName?: string;
  description?: string;
  category?: string;
}

export interface Eligibility {
  type?: string;
  information?: string;
  description?: string;
}

export interface Contract {
  pricingModel: string;
  gstBasis: GstBasis;
  isFixed?: boolean;
  tariffPeriods: TariffPeriod[];
  controlledLoads: ControlledLoad[];
  solarFeedIn: FeedIn[];
  discounts: Discount[];
  fees: Fee[];
  incentives: Incentive[];
  eligibility: Eligibility[];
  terms: { termType?: string; billFrequency?: string[]; paymentOptions?: string[]; coolingOffDays?: number };
}

export interface EnergyPlan {
  planId: string;
  retailerSlug: string;
  brandName: string;
  displayName: string;
  fuelType: FuelType;
  planType: PlanType;
  customerType: "RESIDENTIAL";
  geography: { includedPostcodes: string[]; excludedPostcodes: string[]; distributors: string[] };
  effectiveFrom?: string;
  effectiveTo?: string;
  electricity?: Contract;
  gas?: Contract;
  planUrl?: string;
  sourceLastUpdated: string;
  fetchedAt: string;
  verifiedAt: string;
  understood: boolean;
  notUnderstood: string[];
}

/** What the store keeps alongside the raw payload. */
export interface NormalisedPlan {
  plan: Omit<EnergyPlan, "fetchedAt" | "verifiedAt">;
  detailHash: string;
}
