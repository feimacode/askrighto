/** Fixed wording for course results: the notice, labels per figure kind, banned phrases and the reading checklist. */
import type { CriterionKind, FigureKind } from "./types.js";

export const COURSE_NOTICE =
  "Past entry figures are not cut-offs or predictions. Prerequisites are as published for the year shown. Check the official course page before deciding. General information, not advice.";

export const AGGREGATE_NOTICE =
  "An aggregate is not an ATAR: the ATAR ranks an aggregate against the whole state cohort. Scaled scores are from a past year's published table and can change. General information, not advice.";

export const FIGURE_LABEL: Record<FigureKind, (year: number) => string> = {
  lowest_selection_rank: (y) =>
    `Lowest selection rank that received an offer in ${y} (after adjustments)`,
  lowest_atar: (y) =>
    `Lowest ATAR that received an offer in ${y} (before adjustments)`,
  guaranteed_atar: (y) => `Guaranteed entry ATAR for ${y} entry`,
  entry_threshold: (y) =>
    `Published minimum entry score for ${y} (a threshold, not an outcome)`,
  median_atar: (y) => `Median ATAR of ${y} offers`,
};

export const CRITERION_LABEL: Record<CriterionKind, string> = {
  folio: "A folio is part of selection",
  interview: "An interview is part of selection",
  audition: "An audition is part of selection",
  test: "A test is part of selection",
  personal_statement: "A personal statement is part of selection",
  recommended: "Suggested background (not required, not checked here)",
  none: "No other selection criteria are listed",
};

/** What the host's browser agent should read on an index-only course page. */
export const READING_CHECKLIST = [
  "The entry figure for the latest intake, with what kind of figure it is (lowest selection rank, guaranteed ATAR and so on) and which intake year",
  "VCE prerequisites, with the minimum study scores and any different minimum for EAL",
  "Other selection criteria (folio, interview, audition, test, personal statement)",
  "The date the page says it was last updated, if shown",
] as const;

export const BROWSING_RULES =
  "Read the university page first, then Course Seeker. Do not use VTAC. Quote only the checklist items, with the page link and the time you read them, and say they were read by the assistant from that page, not from Ask Righto's checked data. If the page shows a bot check or will not load, give the user the link instead.";

/** Words the course tools never use about a result. */
export const BANNED_PHRASES: readonly RegExp[] = [
  /\bchances?\b/i,
  /you will get in/i,
  /you'll get in/i,
  /\bbest course\b/i,
  /\brecommended\b/i,
  /\bguaranteed to get\b/i,
];

export function bannedIn(text: string): string[] {
  return BANNED_PHRASES.filter((r) => r.test(text)).map((r) => r.source);
}
