/** VCE admissions data shapes (add-vce-admissions-data). */

export interface KeyDate {
  key: string;
  title: string;
  date: string;
  endDate?: string;
  issuingBody: "VCAA" | "VTAC";
  phase: string;
  sourceUrl: string;
  checkedOn: string;
  provisional?: boolean;
}
export interface KeyDateYear {
  year: number;
  dates: KeyDate[];
}
export interface PreferenceRule {
  id: string;
  title: string;
  text: string;
  sourceUrl: string;
  checkedOn: string;
  provisional?: boolean;
}
/** A description of a university scheme. There is deliberately no eligibility field. */
export interface EarlyEntryScheme {
  id: string;
  admissionsYear: number;
  university: string;
  name: string;
  summary: string;
  offerType: string;
  guaranteedAtar: boolean;
  applicationWindow?: string;
  sourceUrl: string;
  checkedOn: string;
  provisional?: boolean;
  note?: string;
}

/** Scaled score at published raw study scores, by study id. */
export interface ScalingTable {
  studyYear: number;
  sourceUrl: string;
  studies: Array<{
    studyId: string;
    name: string;
    points: Array<[raw: number, scaled: number]>;
  }>;
}
/** Study area grouping by study id: studies in the same group are limited in the aggregate. */
export interface Groupings {
  studyYear: number;
  sourceUrl: string;
  /** study id to group name */
  groupOf: Record<string, string>;
  englishGroup: string;
}

export interface VceData {
  keyDates: KeyDateYear[];
  preferenceRules: PreferenceRule[];
  preferenceRulesYear?: number;
  earlyEntry: EarlyEntryScheme[];
  scaling: ScalingTable[];
  groupings: Groupings[];
  loadedAt: Date;
}

export interface VceSource {
  data(): Promise<VceData>;
}
