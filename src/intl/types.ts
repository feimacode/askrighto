/** International course model (CRICOS-based). Facts are stored as published; null/undefined means not published. */
export const LEVEL_GROUPS = [
  "associate_degree",
  "bachelor",
  "graduate_certificate",
  "graduate_diploma",
  "master",
  "doctorate",
  "advanced_diploma",
  "diploma",
  "certificate_iv",
  "certificate_iii",
  "certificate_ii",
  "certificate_i",
] as const;
export type LevelGroup = (typeof LEVEL_GROUPS)[number];

export const SECTORS = ["higher_education", "vet"] as const;
export type Sector = (typeof SECTORS)[number];

export interface IntlLocation {
  state: string;
  campus: string;
}

export interface IntlProvider {
  id: string;
  name: string;
  website?: string;
}

export interface IntlCourse {
  cricosCode: string;
  providerId: string;
  name: string;
  /** Level exactly as the register words it. */
  level: string;
  levelGroup: LevelGroup;
  /** Training sector. Unset for a diploma the register gives no VET National Code (never inferred). */
  sector?: Sector;
  /** VET National Code exactly as published. */
  vetNationalCode?: string;
  field?: string;
  durationWeeks?: number;
  /** Total tuition fee in whole or fractional AUD, as published. */
  tuitionFeeTotal?: number;
  nonTuitionFee?: number;
  language?: string;
  workComponent?: boolean;
  expired: boolean;
  locations: IntlLocation[];
  /** Id of the domestic course with the same CRICOS code, when one is loaded. */
  domesticCourseId?: string;
}

export interface IntlData {
  providers: IntlProvider[];
  courses: IntlCourse[];
  /** Date of the CRICOS file the rows came from. */
  sourceDate: Date;
  sourceFile: string;
  loadedAt: Date;
}

export interface IntlSource {
  data(): Promise<IntlData>;
}
