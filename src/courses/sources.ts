/**
 * Source index for admissions (index-only): where the agent reads scaling, dates, preferences, adjustment schemes,
 * early entry and subject rules, by state. Links and reading checklists only. Nothing from these pages is stored.
 * `checkedOn` says a person has confirmed the link loads and is the page meant; until then results carry a
 * warning (generalise-admissions-sources, task 1). On 28 Nov 2026 the device session opened each link: entries it
 * confirmed carry `checkedOn`; entries still pointing at a home page or search page, and the QCAA site (it showed a
 * bot check), do not. Checklist wording has not been checked against the pages.
 */
export const STATES = ["vic", "nsw", "act", "qld"] as const;
export type AdmissionsState = (typeof STATES)[number];

export const TOPICS = [
  "scaling",
  "atar-rules",
  "key-dates",
  "preferences",
  "early-entry",
  "adjustment-factors",
  "subject-rules",
] as const;
export type Topic = (typeof TOPICS)[number];

export interface StateInfo {
  state: AdmissionsState;
  stateName: string;
  /** The admissions centre students apply through. */
  centre: string;
  centreUrl: string;
  /** The senior secondary certificate. */
  certificate: string;
  /** The body that publishes the certificate's subject rules. */
  authority: string;
  /** Names of the entry figures universities in this state publish: names only, no values. Unconfirmed. */
  figureKinds: readonly string[];
}

export const STATE_INFO: Readonly<Record<AdmissionsState, StateInfo>> = {
  vic: {
    state: "vic",
    stateName: "Victoria",
    centre: "VTAC",
    centreUrl: "https://vtac.edu.au/",
    certificate: "VCE",
    authority: "VCAA",
    figureKinds: ["ATAR", "VCE aggregate", "selection rank"],
  },
  nsw: {
    state: "nsw",
    stateName: "New South Wales",
    centre: "UAC",
    centreUrl: "https://uac.edu.au/",
    certificate: "HSC",
    authority: "NESA",
    figureKinds: ["ATAR", "selection rank"],
  },
  act: {
    state: "act",
    stateName: "Australian Capital Territory",
    centre: "UAC",
    centreUrl: "https://uac.edu.au/",
    certificate: "ACT Senior Secondary Certificate",
    authority: "ACT Board of Senior Secondary Studies",
    figureKinds: ["ATAR", "selection rank"],
  },
  qld: {
    state: "qld",
    stateName: "Queensland",
    centre: "QTAC",
    centreUrl: "https://www.qtac.edu.au/",
    certificate: "QCE",
    authority: "QCAA",
    figureKinds: ["ATAR", "selection rank"],
  },
};

export interface SourceEntry {
  id: Topic;
  state: AdmissionsState;
  title: string;
  publisher: string;
  url: string;
  kind: "report_pdf" | "official_page" | "search_page";
  readingChecklist: readonly string[];
  /** ISO date the link was last opened and confirmed to be the page meant (the checklist wording is not checked); absent while unconfirmed. */
  checkedOn?: string;
  /** Date the entry was added to the index. */
  indexedOn: string;
}

const INDEXED = "2026-11-28";
type Row = Omit<SourceEntry, "state" | "indexedOn" | "publisher"> & { publisher?: string };
const forState = (state: AdmissionsState, rows: readonly Row[]): SourceEntry[] =>
  rows.map((r) => ({
    ...r,
    state,
    publisher: r.publisher ?? STATE_INFO[state].centre,
    indexedOn: INDEXED,
  }));

const SCALING_CHECKS = [
  "Which year the report or guide is for",
  "The scaled score for each study at a given raw score, from the report's table, under the name the report uses for that study",
  "Whether the study is listed on its own or inside a group",
];
const DATES_CHECKS = [
  "The intake year the dates are for",
  "Application, preference change and offer round dates the page lists",
];
const PREFS_CHECKS = [
  "How preferences are ordered and how offers are made",
  "The rules for changing preferences and the dates they apply to",
];
const EARLY_CHECKS = [
  "The scheme's name and which course types it covers",
  "What a student must do, and by when",
  "The university's own wording on who can apply (never say a student is eligible)",
];
const ADJUST_CHECKS = [
  "The names of the adjustment or bonus schemes the centre lists",
  "What each scheme says it is for, in the page's own words",
  "How and by when to apply, and which universities take part",
  "Never say a student qualifies; the centre and the university decide",
];
const SUBJECT_CHECKS = [
  "Where the authority lists subjects, and what it calls them",
  "How a university's prerequisite wording maps to those names",
  "Any subject that exists in more than one level or form, and which the university names",
];
const rulesChecks = (lead: string) => [
  lead,
  "How the later studies are counted, if the page says so",
  "That an aggregate or rank is not an ATAR unless the page says it is",
];

const CHECKED = "2026-11-28";
/** QCAA's site showed a bot check to a plain read on 28 Nov 2026; the agent must not try to get past it. */
const QCAA_NOTE = " (this site showed a bot check to a plain read: give the user the link if it will not load)";

export const SOURCES: readonly SourceEntry[] = [
  ...forState("vic", [
    { id: "scaling", title: "VTAC ATAR scaling guide (guides are by year of completing Year 12; take the newest)", url: "https://vtac.edu.au/guides/atar-scaling-guide-2027.html", kind: "official_page", readingChecklist: SCALING_CHECKS, checkedOn: CHECKED },
    {
      id: "atar-rules",
      title: "How the ATAR and the aggregate are calculated",
      url: "https://vtac.edu.au/atar",
      kind: "official_page",
      readingChecklist: [
        "Which studies count in the primary four, and any English requirement",
        "How the fifth and sixth studies are counted, and the percentage given to them",
        "That an aggregate is not an ATAR",
      ],
      checkedOn: CHECKED,
    },
    { id: "key-dates", title: "VTAC key dates", url: "https://vtac.edu.au/dates", kind: "official_page", readingChecklist: DATES_CHECKS, checkedOn: CHECKED },
    { id: "preferences", title: "VTAC preferences and offers", url: "https://vtac.edu.au/offers", kind: "official_page", readingChecklist: PREFS_CHECKS, checkedOn: CHECKED },
    {
      id: "early-entry",
      title: "University early entry and early offer schemes (VTAC has no central page: find each scheme on the university's own admissions page)",
      publisher: "Each university",
      url: "https://vtac.edu.au/",
      kind: "search_page",
      readingChecklist: EARLY_CHECKS,
    },
    { id: "adjustment-factors", title: "VTAC equity schemes and scholarships", url: "https://vtac.edu.au/access/applying.html", kind: "official_page", readingChecklist: ADJUST_CHECKS, checkedOn: CHECKED },
    { id: "subject-rules", title: "VCE study designs and subjects (VCAA; find the study on the site)", publisher: "VCAA", url: "https://www.vcaa.vic.edu.au/", kind: "search_page", readingChecklist: SUBJECT_CHECKS },
  ]),
  ...forState("nsw", [
    { id: "scaling", title: "UAC ATAR page (links the newest scaling report)", url: "https://uac.edu.au/future-applicants/atar", kind: "official_page", readingChecklist: SCALING_CHECKS, checkedOn: CHECKED },
    {
      id: "atar-rules",
      title: "How your ATAR is calculated (UAC)",
      url: "https://uac.edu.au/future-applicants/atar/how-your-atar-is-calculated",
      kind: "official_page",
      readingChecklist: rulesChecks("Which HSC courses count towards the ATAR, and any English requirement"),
      checkedOn: CHECKED,
    },
    { id: "key-dates", title: "UAC key dates", url: "https://uac.edu.au/key-dates", kind: "official_page", readingChecklist: DATES_CHECKS, checkedOn: CHECKED },
    { id: "preferences", title: "UAC undergraduate applications and offers", url: "https://uac.edu.au/current-applicants/undergraduate-applications-and-offers", kind: "official_page", readingChecklist: PREFS_CHECKS, checkedOn: CHECKED },
    {
      id: "early-entry",
      title: "Early offer schemes for Year 12 students (UAC)",
      url: "https://uac.edu.au/current-applicants/undergraduate-applications-and-offers/early-offer-schemes-for-year-12-students",
      kind: "official_page",
      readingChecklist: EARLY_CHECKS,
      checkedOn: CHECKED,
    },
    { id: "adjustment-factors", title: "UAC educational access schemes", url: "https://uac.edu.au/future-applicants/scholarships-and-schemes/educational-access-schemes", kind: "official_page", readingChecklist: ADJUST_CHECKS, checkedOn: CHECKED },
    { id: "subject-rules", title: "NSW curriculum: HSC subjects and syllabuses (NESA's own site is at nsw.gov.au/education-and-training/nesa)", publisher: "NESA", url: "https://curriculum.nsw.edu.au/learning-areas", kind: "search_page", readingChecklist: SUBJECT_CHECKS, checkedOn: CHECKED },
  ]),
  ...forState("act", [
    { id: "scaling", title: "ACT scaling and the ATAR (the Board reports the ATAR)", publisher: "ACT Board of Senior Secondary Studies", url: "https://www.bsss.act.edu.au/act_senior_secondary_system/assessment,_scaling_and_the_atar/scaling_and_the_atar", kind: "official_page", readingChecklist: SCALING_CHECKS, checkedOn: CHECKED },
    {
      id: "atar-rules",
      title: "How the ATAR is worked out for ACT students (the Board reports it on the Tertiary Entrance Statement)",
      publisher: "ACT Board of Senior Secondary Studies",
      url: "https://www.bsss.act.edu.au/act_senior_secondary_system/assessment,_scaling_and_the_atar/scaling_and_the_atar",
      kind: "official_page",
      readingChecklist: rulesChecks("Which ACT courses count towards the ATAR, and any requirement the page names"),
      checkedOn: CHECKED,
    },
    { id: "key-dates", title: "UAC key dates", url: "https://uac.edu.au/key-dates", kind: "official_page", readingChecklist: DATES_CHECKS, checkedOn: CHECKED },
    { id: "preferences", title: "UAC undergraduate applications and offers", url: "https://uac.edu.au/current-applicants/undergraduate-applications-and-offers", kind: "official_page", readingChecklist: PREFS_CHECKS, checkedOn: CHECKED },
    {
      id: "early-entry",
      title: "Early offer schemes for Year 12 students (UAC)",
      url: "https://uac.edu.au/current-applicants/undergraduate-applications-and-offers/early-offer-schemes-for-year-12-students",
      kind: "official_page",
      readingChecklist: EARLY_CHECKS,
      checkedOn: CHECKED,
    },
    { id: "adjustment-factors", title: "UAC educational access schemes", url: "https://uac.edu.au/future-applicants/scholarships-and-schemes/educational-access-schemes", kind: "official_page", readingChecklist: ADJUST_CHECKS, checkedOn: CHECKED },
    { id: "subject-rules", title: "ACT Senior Secondary Certificate courses", publisher: "ACT Board of Senior Secondary Studies", url: "https://www.bsss.act.edu.au/act_senior_secondary_system/curriculum/bsss_courses", kind: "official_page", readingChecklist: SUBJECT_CHECKS, checkedOn: CHECKED },
  ]),
  ...forState("qld", [
    { id: "scaling", title: "QTAC ATAR page (ATAR rules and scaling)", url: "https://www.qtac.edu.au/atar/", kind: "official_page", readingChecklist: SCALING_CHECKS, checkedOn: CHECKED },
    {
      id: "atar-rules",
      title: "How the ATAR is calculated (QTAC)",
      url: "https://www.qtac.edu.au/atar/",
      kind: "official_page",
      readingChecklist: rulesChecks("Which QCE subjects count towards the ATAR, and any English requirement"),
      checkedOn: CHECKED,
    },
    { id: "key-dates", title: "QTAC key information, dates and offer rounds", url: "https://www.qtac.edu.au/key-info/", kind: "official_page", readingChecklist: DATES_CHECKS, checkedOn: CHECKED },
    { id: "preferences", title: "QTAC key information, preferences and offers", url: "https://www.qtac.edu.au/key-info/", kind: "official_page", readingChecklist: PREFS_CHECKS, checkedOn: CHECKED },
    {
      id: "early-entry",
      title: "University early entry and early offer schemes (QTAC has no central page: find each scheme on the university's own admissions page)",
      publisher: "Each university",
      url: "https://www.qtac.edu.au/",
      kind: "search_page",
      readingChecklist: EARLY_CHECKS,
    },
    { id: "adjustment-factors", title: "QTAC assistance schemes", url: "https://www.qtac.edu.au/assistance-schemes/", kind: "official_page", readingChecklist: ADJUST_CHECKS, checkedOn: CHECKED },
    { id: "subject-rules", title: "QCE subjects and syllabuses (QCAA)" + QCAA_NOTE, publisher: "QCAA", url: "https://www.qcaa.qld.edu.au/", kind: "search_page", readingChecklist: SUBJECT_CHECKS },
  ]),
];

/** The entries for one state, optionally one topic. */
export function sourcesFor(state: AdmissionsState, topic: Topic | "all" = "all"): SourceEntry[] {
  return SOURCES.filter((s) => s.state === state && (topic === "all" || s.id === topic));
}

/** Sentence on every result: figures from different states are different measures. */
export const COMPARABILITY_NOTICE =
  "Entry figures from different states' systems are different measures: do not compare a figure from one state with another's, and never convert an aggregate or rank into an ATAR or the reverse.";

/** Link-only pointer shown beside every domestic course. Never read for content. */
export const COURSE_SEEKER_URL = "https://www.courseseeker.edu.au/";

export const UNVERIFIED_WARNING =
  "Some of these links are indexed but not yet confirmed as the right page; if one fails or looks wrong, tell the user and use the provider's own site or the centre's home page.";
