/**
 * Source index for VCE admissions (index-only): where the agent reads scaling, dates, preferences and early entry.
 * Links and reading checklists only. Nothing from these pages is stored. `verified` says whether a person has
 * confirmed the link loads and is the page meant; until then results carry a warning (switch-to-index-only, task 1.2).
 */
export interface SourceEntry {
  id: "scaling" | "atar-rules" | "key-dates" | "preferences" | "early-entry";
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

const INDEXED = "2026-11-27";

export const VCE_SOURCES: readonly SourceEntry[] = [
  {
    id: "scaling",
    title: "VTAC ATAR scaling reports (most recent report)",
    publisher: "VTAC",
    url: "https://www.vtac.edu.au/atar/scaling",
    kind: "report_pdf",
    indexedOn: INDEXED,
    readingChecklist: [
      "Which year the newest report is for",
      "The scaled score for each study at a given raw study score, from the report's table, under the name the report uses for that study",
      "Whether the study is listed on its own or inside a group",
    ],
  },
  {
    id: "atar-rules",
    title: "How the ATAR and the aggregate are calculated",
    publisher: "VTAC",
    url: "https://www.vtac.edu.au/atar",
    kind: "official_page",
    indexedOn: INDEXED,
    readingChecklist: [
      "Which studies count in the primary four, and any English requirement",
      "How the fifth and sixth studies are counted, and the percentage given to them",
      "That an aggregate is not an ATAR",
    ],
  },
  {
    id: "key-dates",
    title: "VTAC key dates",
    publisher: "VTAC",
    url: "https://www.vtac.edu.au/dates",
    kind: "official_page",
    indexedOn: INDEXED,
    readingChecklist: [
      "The intake year the dates are for",
      "Application, preference change and offer round dates the page lists",
    ],
  },
  {
    id: "preferences",
    title: "VTAC preferences and offers",
    publisher: "VTAC",
    url: "https://www.vtac.edu.au/offers",
    kind: "official_page",
    indexedOn: INDEXED,
    readingChecklist: [
      "How preferences are ordered and how offers are made",
      "The rules for changing preferences and the dates they apply to",
    ],
  },
  {
    id: "early-entry",
    title: "University early entry and early offer schemes",
    publisher: "Each university (find the scheme on the university's own admissions page)",
    url: "https://www.vtac.edu.au/offers",
    kind: "search_page",
    indexedOn: INDEXED,
    readingChecklist: [
      "The scheme's name and which course types it covers",
      "What a student must do, and by when",
      "The university's own wording on who can apply (never say a student is eligible)",
    ],
  },
] as const;

/** Link-only pointers shown beside every domestic course. Never read for content. */
export const COURSE_SEEKER_URL = "https://www.courseseeker.edu.au/";
export const VTAC_URL = "https://www.vtac.edu.au/";

export const UNVERIFIED_WARNING =
  "These links are indexed but not yet confirmed by a person as the right page; if one fails or looks wrong, tell the user and use the provider's own site.";
