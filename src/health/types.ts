/** Private health cover model. Facts are stored as published; undefined means the file did not publish it. */
export const COVER_KINDS = ["hospital", "general_treatment", "combined"] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

export const HOUSEHOLDS = ["single", "couple", "family", "single_parent"] as const;
export type Household = (typeof HOUSEHOLDS)[number];

/** A product can also cover only dependants (no adult), which the file allows. */
export type ProductHousehold = Household | "dependants_only";

export const FREQUENCIES = ["weekly", "fortnightly", "monthly", "quarterly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Whether a published premium is before the rebate, already after a stated rebate tier, or not said. */
export type PremiumBasis = "before_rebate" | "after_rebate" | "unknown";
export type CoverState = "covered" | "restricted" | "not_covered";

export interface HealthInsurer {
  /** The file's FundCode, lower-cased (for example "aca"). */
  id: string;
  name: string;
  /** Open to anyone, or restricted to a group (the file's FundType). */
  fundType?: "open" | "restricted";
  /** For a restricted fund, the file's one-line hint about who can join. */
  restrictionHint?: string;
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
  /** The file's own MedicalService title (CamelCase, for example BackNeckSpine); never replaced by a fixed list. */
  code: string;
  label: string;
  cover: CoverState;
}

/** One letter per category, in the order of HealthData.categoryTitles: C covered, R restricted, N not covered. */
export const COVER_LETTER: Record<string, CoverState> = { C: "covered", R: "restricted", N: "not_covered" };

export interface HealthWaiting {
  type: string;
  months: number;
}

export interface HealthProduct {
  /** The file's ProductID (a GUID, unique across all six product files). */
  id: string;
  insurerId: string;
  code: string;
  name: string;
  kind: CoverKind;
  /** Hospital tier code exactly as the file words it. */
  tier?: string;
  state?: string;
  household?: ProductHousehold;
  /** The file's Status: open to new members, or closed. */
  status: "open" | "closed";
  /** Excess as the file words it (None, PerAdmissionOnly, LimitedPerYear, LimitedPerPerson, LimitedPerPersonPerPolicy). */
  excessType?: string;
  excessPerAdmissionCents?: number;
  excessPerPersonCents?: number;
  excessPerPolicyCents?: number;
  /** The single figure used to filter and sort by excess: per person, else per policy, else per admission, else 0 for None. */
  excessCents?: number;
  /** Co-payment type as the file words it (None, Limited, Unlimited). */
  coPaymentType?: string;
  /** The file's MedicareLevySurchargeExempt flag. */
  mlsExempt?: boolean;
  corporate?: boolean;
  /** The file's OnlyAvailableWith, as text ("any hospital", "any general health", or the product group codes). */
  onlyAvailableWith?: string;
  /** Dependant groups the policy covers (the file's DependantCover titles with Covered=true). */
  dependantsCovered?: string[];
  /** The monthly premium before any rebate. */
  premiums: HealthPremium[];
  /** Hospital part of the monthly premium, whole cents, when the file gives one above zero. */
  hospitalComponentCents?: number;
  /** One letter per category; see COVER_LETTER and HealthData.categoryTitles. Empty when the product has no hospital cover. */
  coverCodes: string;
  waiting: HealthWaiting[];
  /** The insurer's own page for the product (the file's ProductURL), only when the file carries one. */
  infoUrl?: string;
}

export interface HealthData {
  insurers: HealthInsurer[];
  products: HealthProduct[];
  /** The 38 MedicalService titles, in the file's order; indexes HealthProduct.coverCodes. */
  categoryTitles: string[];
  /** Date of the PHIO file the rows came from. */
  sourceDate: Date;
  sourceFile: string;
  loadedAt: Date;
}

export interface HealthSource {
  data(): Promise<HealthData>;
}

/** The clinical categories of a product, as the file states them. */
export function categoriesOf(d: Pick<HealthData, "categoryTitles">, p: Pick<HealthProduct, "coverCodes">): HealthCategory[] {
  const out: HealthCategory[] = [];
  for (let i = 0; i < p.coverCodes.length; i++) {
    const cover = COVER_LETTER[p.coverCodes[i]!];
    const title = d.categoryTitles[i];
    if (cover && title) out.push({ code: title, label: title, cover });
  }
  return out;
}
