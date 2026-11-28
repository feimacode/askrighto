/** Fixed wording for course results: the notice, the reading checklist for a course page and the browsing rules. */

export const COURSE_NOTICE =
  "Ask Righto holds no entry figures or prerequisites and has not read the university's page. Anything you read there is past or published information, not a cut-off or a prediction. Check the official course page before deciding. General information, not advice.";

export const AGGREGATE_NOTICE =
  "An aggregate is not an ATAR: a state's ATAR ranks students against the whole cohort. Scaled scores come from a past year's published report and can change. General information, not advice.";

/** What the host's browser agent should read on a university course page. */
export const READING_CHECKLIST = [
  "The entry figure for the latest intake, with what kind of figure it is (lowest selection rank, guaranteed ATAR and so on) and which intake year",
  "Subject prerequisites or assumed knowledge as the page names them (VCE, HSC, ACT or QCE subjects), with any minimum score or level the page gives",
  "Other selection criteria (folio, interview, audition, test, personal statement)",
  "The date the page says it was last updated, if shown",
] as const;

export const BROWSING_RULES =
  "Read the university's own course page first. Course Seeker and admissions centre (VTAC, UAC, QTAC) links are for the user only: do not read them for content. Quote only the checklist items, with the page link and the time you read them, and say they were read by the assistant from that page, not from Ask Righto's data. Never send what you read back to an Ask Righto tool. If the page shows a bot check, a login or will not load, give the user the link and stop.";

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
