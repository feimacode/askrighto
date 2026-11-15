/** Course model shared by the YAML schema, the loader, the store and the tools. */

export const FIGURE_KINDS = [
  "lowest_atar",
  "lowest_selection_rank",
  "guaranteed_atar",
  "entry_threshold",
  "median_atar",
] as const;
export type FigureKind = (typeof FIGURE_KINDS)[number];

export const CRITERION_KINDS = [
  "folio",
  "interview",
  "audition",
  "test",
  "personal_statement",
  "recommended",
  "none",
] as const;
export type CriterionKind = (typeof CRITERION_KINDS)[number];

/** One requirement on a study. `study` is a study id or a group id from data/vce-studies.yaml. */
export interface Leaf {
  study: string;
  minScore?: number;
  /** Minimum when the student sits English as an Additional Language (only for English groups). */
  ealMinScore?: number;
}
export type Rule = { allOf: Rule[] } | { anyOf: Rule[] } | Leaf;

export interface EntryFigure {
  kind: FigureKind;
  value: number;
  intakeYear: number;
  campus?: string;
  sourceUrl: string;
  checkedOn: string;
}

export interface PrerequisiteBlock {
  appliesToYear: number;
  /** Our paraphrase of the official wording, for display. */
  text: string;
  /** What code evaluates. The list is all-of. */
  rules: Rule[];
  sourceUrl: string;
  checkedOn: string;
}

export interface OtherCriterion {
  kind: CriterionKind;
  note?: string;
}

export type Origin = "cricos" | "gap_fill";
export type Depth = "index_only" | "curated";

export interface Provider {
  id: string;
  name: string;
  coursesUrl: string;
  /** Domains the provider's own pages live on, used to check links and sources. */
  domains: string[];
  /** CRICOS provider code, used to pick this provider's rows from the CRICOS file. */
  cricosProviderCode?: string;
  /** The provider's course search link, given when a course is not in the index. */
  searchUrl?: string;
}

export interface Course {
  id: string;
  providerId: string;
  origin: Origin;
  depth: Depth;
  name: string;
  level: string;
  fields: string[];
  campuses: string[];
  durationYears?: number;
  cricosCode?: string;
  vtacCode?: string;
  officialUrl?: string;
  courseSeekerUrl?: string;
  foundAt?: string;
  summary?: string;
  checkedOn?: string;
  checkedBy?: string;
  entryFigures: EntryFigure[];
  prerequisites: PrerequisiteBlock[];
  otherCriteria: OtherCriterion[];
  /** Set by the loader when CRICOS supplied the index fields. */
  fromCricos?: boolean;
}

export interface ProviderFile {
  provider: Provider;
  courses: Course[];
}
