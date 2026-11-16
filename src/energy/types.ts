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
  /**
   * Period the block threshold applies to, e.g. P1D, P1M. The standards put `period` on the
   * rate block (singleRate, timeOfUseRates[], feed-in tariff), not on each rate; it is copied
   * here so every block rate carries it.
   */
  period?: string;
}

export interface TimeWindow {
  days: string[];
  startTime?: string;
  endTime?: string;
}

export interface TimeOfUseRate {
  type: string; // PEAK, OFF_PEAK, SHOULDER, SHOULDER1, SHOULDER2, SOLAR_SPONGE (controlled load), ...
  displayName?: string;
  rates: Rate[];
  windows: TimeWindow[];
  /** Controlled load only: the standards give each controlled load rate block its own supply charge. */
  dailySupplyCharge?: number;
}

export interface TariffPeriod {
  displayName?: string;
  startDate?: string; // MM-DD
  endDate?: string;
  /** Daily supply charge, scaled integer dollars per day. Absent when the supply charge is banded. */
  dailySupplyCharge?: number;
  /** dailySupplyChargeType BAND: supply charge per day by volume band (not costed yet). */
  bandedDailySupplyCharges?: Rate[];
  singleRate?: Rate[];
  timeOfUse?: TimeOfUseRate[];
  hasDemandCharges: boolean;
}

export interface ControlledLoad {
  displayName?: string;
  /** From `singleRate.dailySupplyCharge`; time-of-use controlled loads carry it per rate block. */
  dailySupplyCharge?: number;
  singleRate?: Rate[];
  timeOfUse?: TimeOfUseRate[];
}

export interface FeedIn {
  displayName?: string;
  description?: string;
  scheme?: string; // PREMIUM, CURRENT, VARIABLE, OTHER
  payerType?: string; // GOVERNMENT, RETAILER
  startDate?: string;
  endDate?: string;
  /** singleTariff rates; empty when the tariff varies by time. */
  rates: Rate[];
  timeVarying: boolean;
  /** timeVaryingTariffs (an array since Get Generic Plan Detail v3), with their time windows. */
  timeVaryingTariffs?: TimeOfUseRate[];
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
  terms: {
    termType?: string;
    billFrequency?: string[];
    paymentOptions?: string[];
    coolingOffDays?: number;
  };
}

export interface EnergyPlan {
  planId: string;
  retailerSlug: string;
  brandName: string;
  displayName: string;
  fuelType: FuelType;
  planType: PlanType;
  customerType: "RESIDENTIAL";
  geography: {
    includedPostcodes: string[];
    excludedPostcodes: string[];
    distributors: string[];
  };
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
