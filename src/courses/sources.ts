/**
 * Source index for admissions (index-only): where the agent reads scaling, dates, preferences, adjustment schemes,
 * early entry and subject rules, by state. Links and reading checklists only. Nothing from these pages is stored.
 * `checkedOn` says a person has confirmed the link loads and is the page meant; until then results carry a
 * warning (generalise-admissions-sources, task 1). No page here could be reached when the table was written, so
 * every entry is unconfirmed; pages the author was unsure of point at the centre's site and say where to look.
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
    centreUrl: "https://www.vtac.edu.au/",
    certificate: "VCE",
    authority: "VCAA",
    figureKinds: ["ATAR", "VCE aggregate", "selection rank"],
  },
  nsw: {
    state: "nsw",
    stateName: "New South Wales",
    centre: "UAC",
    centreUrl: "https://www.uac.edu.au/",
    certificate: "HSC",
    authority: "NESA",
    figureKinds: ["ATAR", "selection rank"],
  },
  act: {
    state: "act",
    stateName: "Australian Capital Territory",
    centre: "UAC",
    centreUrl: "https://www.uac.edu.au/",
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
  /** ISO date a person last confirmed the link; absent while unverified. */
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
  "Which year the newest report is for",
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

export const SOURCES: readonly SourceEntry[] = [
  ...forState("vic", [
    { id: "scaling", title: "VTAC ATAR scaling reports (most recent report)", url: "https://www.vtac.edu.au/atar/scaling", kind: "report_pdf", readingChecklist: SCALING_CHECKS },
    {
      id: "atar-rules",
      title: "How the ATAR and the aggregate are calculated",
      url: "https://www.vtac.edu.au/atar",
      kind: "official_page",
      readingChecklist: [
        "Which studies count in the primary four, and any English requirement",
        "How the fifth and sixth studies are counted, and the percentage given to them",
        "That an aggregate is not an ATAR",
      ],
    },
    { id: "key-dates", title: "VTAC key dates", url: "https://www.vtac.edu.au/dates", kind: "official_page", readingChecklist: DATES_CHECKS },
    { id: "preferences", title: "VTAC preferences and offers", url: "https://www.vtac.edu.au/offers", kind: "official_page", readingChecklist: PREFS_CHECKS },
    {
      id: "early-entry",
      title: "University early entry and early offer schemes",
      publisher: "Each university (find the scheme on the university's own admissions page)",
      url: "https://www.vtac.edu.au/offers",
      kind: "search_page",
      readingChecklist: EARLY_CHECKS,
    },
    { id: "adjustment-factors", title: "VTAC adjustment schemes (find the current scheme on the VTAC site)", url: "https://www.vtac.edu.au/", kind: "search_page", readingChecklist: ADJUST_CHECKS },
    { id: "subject-rules", title: "VCE study designs and subjects", publisher: "VCAA", url: "https://www.vcaa.vic.edu.au/", kind: "search_page", readingChecklist: SUBJECT_CHECKS },
  ]),
  ...forState("nsw", [
    { id: "scaling", title: "UAC ATAR and scaling information (find the newest scaling report)", url: "https://www.uac.edu.au/atar", kind: "search_page", readingChecklist: SCALING_CHECKS },
    {
      id: "atar-rules",
      title: "How the ATAR is calculated (UAC)",
      url: "https://www.uac.edu.au/atar",
      kind: "official_page",
      readingChecklist: rulesChecks("Which HSC courses count towards the ATAR, and any English requirement"),
    },
    { id: "key-dates", title: "UAC key dates", url: "https://www.uac.edu.au/", kind: "search_page", readingChecklist: DATES_CHECKS },
    { id: "preferences", title: "UAC applications, preferences and offers", url: "https://www.uac.edu.au/", kind: "search_page", readingChecklist: PREFS_CHECKS },
    {
      id: "early-entry",
      title: "University early entry and early offer schemes",
      publisher: "Each university (find the scheme on the university's own admissions page)",
      url: "https://www.uac.edu.au/",
      kind: "search_page",
      readingChecklist: EARLY_CHECKS,
    },
    { id: "adjustment-factors", title: "UAC adjustment factors and educational access schemes (find the current scheme on the UAC site)", url: "https://www.uac.edu.au/", kind: "search_page", readingChecklist: ADJUST_CHECKS },
    { id: "subject-rules", title: "HSC subjects and courses", publisher: "NESA", url: "https://www.nesa.nsw.edu.au/", kind: "search_page", readingChecklist: SUBJECT_CHECKS },
  ]),
  ...forState("act", [
    { id: "scaling", title: "UAC ATAR and scaling information for ACT students (find the newest scaling report)", url: "https://www.uac.edu.au/atar", kind: "search_page", readingChecklist: SCALING_CHECKS },
    {
      id: "atar-rules",
      title: "How the ATAR is calculated for ACT students",
      publisher: "ACT Board of Senior Secondary Studies and UAC",
      url: "https://www.bsss.act.edu.au/",
      kind: "search_page",
      readingChecklist: rulesChecks("Which ACT courses count towards the ATAR, and any requirement the page names"),
    },
    { id: "key-dates", title: "UAC key dates", url: "https://www.uac.edu.au/", kind: "search_page", readingChecklist: DATES_CHECKS },
    { id: "preferences", title: "UAC applications, preferences and offers", url: "https://www.uac.edu.au/", kind: "search_page", readingChecklist: PREFS_CHECKS },
    {
      id: "early-entry",
      title: "University early entry and early offer schemes",
      publisher: "Each university (find the scheme on the university's own admissions page)",
      url: "https://www.uac.edu.au/",
      kind: "search_page",
      readingChecklist: EARLY_CHECKS,
    },
    { id: "adjustment-factors", title: "UAC adjustment factors and educational access schemes (find the current scheme on the UAC site)", url: "https://www.uac.edu.au/", kind: "search_page", readingChecklist: ADJUST_CHECKS },
    { id: "subject-rules", title: "ACT Senior Secondary Certificate courses", publisher: "ACT Board of Senior Secondary Studies", url: "https://www.bsss.act.edu.au/", kind: "search_page", readingChecklist: SUBJECT_CHECKS },
  ]),
  ...forState("qld", [
    { id: "scaling", title: "QTAC ATAR information (find the newest scaling or ATAR report)", url: "https://www.qtac.edu.au/", kind: "search_page", readingChecklist: SCALING_CHECKS },
    {
      id: "atar-rules",
      title: "How the ATAR is calculated (QTAC)",
      url: "https://www.qtac.edu.au/",
      kind: "search_page",
      readingChecklist: rulesChecks("Which QCE subjects count towards the ATAR, and any English requirement"),
    },
    { id: "key-dates", title: "QTAC key dates", url: "https://www.qtac.edu.au/", kind: "search_page", readingChecklist: DATES_CHECKS },
    { id: "preferences", title: "QTAC applications, preferences and offers", url: "https://www.qtac.edu.au/", kind: "search_page", readingChecklist: PREFS_CHECKS },
    {
      id: "early-entry",
      title: "University early entry and early offer schemes",
      publisher: "Each university (find the scheme on the university's own admissions page)",
      url: "https://www.qtac.edu.au/",
      kind: "search_page",
      readingChecklist: EARLY_CHECKS,
    },
    { id: "adjustment-factors", title: "QTAC adjustment and access schemes (find the current scheme on the QTAC site)", url: "https://www.qtac.edu.au/", kind: "search_page", readingChecklist: ADJUST_CHECKS },
    { id: "subject-rules", title: "QCE subjects and syllabuses", publisher: "QCAA", url: "https://www.qcaa.qld.edu.au/", kind: "search_page", readingChecklist: SUBJECT_CHECKS },
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
  "These links are indexed but not yet confirmed by a person as the right page; if one fails or looks wrong, tell the user and use the provider's own site or the centre's home page.";
