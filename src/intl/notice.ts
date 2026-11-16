/** Fixed wording for international course results. */
export const INTL_NOTICE =
  "Fees and durations are as published in the CRICOS register and can differ from the provider's own page; check the provider before deciding. General course information only: Ask Righto gives no visa, migration, work-rights or post-study advice. For visas see the Department of Home Affairs.";

export const FEE_LABEL = "Indicative, as published in CRICOS";
export const YEARLY_LABEL = "calculated: total fee divided by duration";

/** What the user's own browsing assistant should read on the provider's page. CRICOS does not hold these. */
export const INTL_READING_CHECKLIST = [
  "The English language requirement (accepted tests and minimum scores) for this course",
  "Academic entry requirements for the student's country or qualification",
  "Intake dates and the application deadline for the intake the student wants",
  "The tuition fee the provider lists for this course and year, and any scholarships it lists",
  "The date the page says it was last updated, if shown",
] as const;

export const INTL_BROWSING_RULES =
  "Read the provider's own page for this course. Quote only the checklist items, with the page link and the time you read them, and say they were read by the assistant from that page, not from Ask Righto's data. If the page shows a bot check or will not load, give the user the link instead.";

export const INTL_NO_ADVICE =
  "Ask Righto does not give visa, migration, work-rights or post-study advice. For those, see the Department of Home Affairs (https://immi.homeaffairs.gov.au).";

export const CRICOS_SOURCE = {
  name: "CRICOS, Australian Government Department of Education, via data.gov.au",
  url: "https://data.gov.au/data/dataset/cricos",
  licence: "CC BY 2.5 AU",
} as const;
