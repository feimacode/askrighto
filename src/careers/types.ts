/** Career outcomes data model: one row per occupation row of the JSA employment projections file. */

export interface Occupation {
  /** ANZSCO code as text: 1 digit (major group) to 4 digits (unit group). */
  code: string;
  /** 1 major group, 2 sub-major, 3 minor, 4 unit group. */
  level: 1 | 2 | 3 | 4;
  /** The file's "not further defined" rows. */
  nfd: boolean;
  name: string;
  /** Skill level text as published: "1" to "5", or "-" for the higher levels. */
  skillLevel?: string;
  /** Employment in thousands of people, as published. Undefined where the file has no value. */
  baselineK?: number;
  midK?: number;
  endK?: number;
  change5K?: number;
  /** Fractions: 0.0766 means 7.66%. */
  change5Pct?: number;
  change10K?: number;
  change10Pct?: number;
}

export interface CareerData {
  occupations: Occupation[];
  baselineLabel: string; // e.g. "May 2025"
  midLabel: string; // e.g. "May 2030"
  endLabel: string; // e.g. "May 2035"
  classification: string; // e.g. "ANZSCO 1.3"
  sourceDate: Date;
  sourceFile: string;
  loadedAt: Date;
}

export interface CareerSource {
  data(): Promise<CareerData>;
}

/**
 * Skill levels and the qualification the JSA data dictionary pairs with each (read 18 Nov 2026 from the
 * employment projections workbook's Data_Dictionary sheet, as reported). Shown as published; this is a
 * level of study, not a field of study.
 */
export const SKILL_LEVEL_QUALIFICATIONS: Readonly<Record<string, string>> = {
  "1": "Bachelor degree or higher",
  "2": "Advanced diploma or diploma",
  "3": "Certificate IV, or Certificate III including at least two years of on-the-job training",
  "4": "Certificate II or III",
  "5": "Certificate I or secondary education",
};
