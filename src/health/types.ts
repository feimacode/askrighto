/** Private health cover model. Facts are stored as published; undefined means the file did not publish it. */
export const COVER_KINDS = ["hospital", "general_treatment", "combined"] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

export const HOUSEHOLDS = ["single", "couple", "family", "single_parent"] as const;
export type Household = (typeof HOUSEHOLDS)[number];

export const FREQUENCIES = ["weekly", "fortnightly", "monthly", "quarterly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Whether a published premium is before the rebate, already after a stated rebate tier, or not said. */
export type PremiumBasis = "before_rebate" | "after_rebate" | "unknown";
export type CoverState = "covered" | "restricted" | "not_covered";

export interface HealthInsurer {
  id: string;
  name: string;
}

export interface HealthPremium {
  /** Whole cents, as published. */
  amountCents: number;
  frequency: Frequency;
  basis: PremiumBasis;
  /** For an after-rebate premium: the rebate tier the file says it was worked out for (base, tier1, tier2, tier3). */
  rebateTier?: string;
}

export interface HealthCategory {
  /** The file's own code and label; never replaced by a fixed list. */
  code: string;
  label: string;
  cover: CoverState;
}

export interface HealthWaiting {
  type: string;
  months: number;
}

export interface HealthProduct {
  /** Stable id for one product variant: insurer code, product code, state, household. */
  id: string;
  insurerId: string;
  code: string;
  name: string;
  kind: CoverKind;
  /** Hospital tier code exactly as the file words it. */
  tier?: string;
  state?: string;
  household?: Household;
  excessCents?: number;
  excessType?: string;
  premiums: HealthPremium[];
  categories: HealthCategory[];
  waiting: HealthWaiting[];
  /** The insurer's information statement page, only when the file carries one. */
  infoUrl?: string;
}

export interface HealthData {
  insurers: HealthInsurer[];
  products: HealthProduct[];
  /** Date of the PHIO file the rows came from. */
  sourceDate: Date;
  sourceFile: string;
  loadedAt: Date;
}

export interface HealthSource {
  data(): Promise<HealthData>;
}
