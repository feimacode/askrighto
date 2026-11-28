/** Shared pieces of the course tools: the course view, the CRICOS source and markdown. */
import { found, notFound, type Found, type NotFound, type Source } from "../core/grounded.js";
import { attributionFor } from "../core/rights.js";
import { admissionsStatesOf, providerOf, type Catalogue } from "../courses/catalogue.js";
import {
  BROWSING_RULES,
  COURSE_NOTICE,
  READING_CHECKLIST,
} from "../courses/notice.js";
import { COURSE_SEEKER_URL, STATE_INFO, type AdmissionsState } from "../courses/sources.js";
import type { Course } from "../courses/types.js";

export const COURSE_DATASETS = ["cricos-register"] as const;

export interface CourseView {
  courseId: string;
  name: string;
  university: string;
  level: string;
  campuses: string[];
  durationYears?: number;
  cricosCode: string;
  /** The university's own course search or course list: where the agent reads the course page. */
  courseSearchUrl?: string;
}

export interface CourseDetail extends CourseView {
  message: string;
  readingChecklist: readonly string[];
  browsingRules: string;
  /**
   * The states whose admissions system lists this provider (a hint: the student's own state of study decides which
   * centre applies). Pass one to get_admissions_sources.
   */
  admissionsStates: AdmissionsState[];
  /** Links for the user only; the agent does not read them for content. */
  userLinks: { courseSeeker: string; admissionsCentres: { name: string; url: string }[] };
}

export const NO_FACTS_MESSAGE =
  "Ask Righto holds only this CRICOS index row. It holds no entry figures or prerequisites for this course. The university's page decides; use the link and the reading checklist below.";

export function viewOf(cat: Catalogue, c: Course): CourseView {
  const prov = providerOf(cat, c);
  const link = prov?.searchUrl ?? prov?.coursesUrl;
  return {
    courseId: c.id,
    name: c.name,
    university: prov?.name ?? c.providerId,
    level: c.level,
    campuses: c.campuses,
    ...(c.durationYears !== undefined ? { durationYears: c.durationYears } : {}),
    cricosCode: c.cricosCode,
    ...(link ? { courseSearchUrl: link } : {}),
  };
}

export function detailOf(cat: Catalogue, c: Course): CourseDetail {
  const states = admissionsStatesOf(providerOf(cat, c));
  const centres = [...new Map(states.map((s) => [STATE_INFO[s].centre, { name: STATE_INFO[s].centre, url: STATE_INFO[s].centreUrl }])).values()];
  return {
    ...viewOf(cat, c),
    message: NO_FACTS_MESSAGE,
    readingChecklist: READING_CHECKLIST,
    browsingRules: BROWSING_RULES,
    admissionsStates: states,
    userLinks: { courseSeeker: COURSE_SEEKER_URL, admissionsCentres: centres },
  };
}

export const CRICOS_SOURCE_URL = "https://data.gov.au/";

export function indexSource(): Source {
  const attribution = attributionFor(["cricos-register"]);
  return {
    name: "CRICOS register, via data.gov.au (Ask Righto course index)",
    url: CRICOS_SOURCE_URL,
    licence: "CC BY 2.5 AU",
    ...(attribution ? { attribution } : {}),
  };
}

export function courseFound<T extends object>(
  data: T,
  cat: Catalogue,
  warnings: string[] = [],
): Found<T & { notice: string }> {
  return found({
    data: { ...data, notice: COURSE_NOTICE },
    source: indexSource(),
    asOf: cat.loadedAt,
    warnings,
  });
}

export function notInIndex(
  cat: Catalogue,
  id: string,
  universityHint?: string,
): NotFound {
  const prov = universityHint
    ? cat.providers.find(
        (p) =>
          p.id === universityHint ||
          p.name.toLowerCase().includes(universityHint.toLowerCase()),
      )
    : undefined;
  return notFound(
    "not_in_dataset",
    `No course with id "${id}" is in the Ask Righto index. Use search_domestic_courses to find the id.${prov ? ` The university's own course search is ${prov.searchUrl ?? prov.coursesUrl}.` : ""}`,
    {
      courseId: id,
      ...(prov ? { courseSearchUrl: prov.searchUrl ?? prov.coursesUrl } : {}),
    },
  );
}

export function courseLine(v: CourseView): string {
  const meta = [
    v.campuses.length ? `Campus: ${v.campuses.join(", ")}` : "",
    v.durationYears ? `${v.durationYears} years full-time` : "",
    `CRICOS ${v.cricosCode}`,
  ].filter(Boolean);
  return `${v.name}, ${v.university} (${meta.join(". ")}). id: ${v.courseId}.${v.courseSearchUrl ? ` Read the course on: ${v.courseSearchUrl}` : ""}`;
}

export function detailMarkdown(d: CourseDetail): string {
  return [
    `### ${d.name}, ${d.university}`,
    courseLine(d),
    d.message,
    "Read on the university's page: " +
      d.readingChecklist.map((x, i) => `${i + 1}) ${x}`).join("; ") +
      ".",
    `How to read it: ${d.browsingRules}`,
    `Admissions system (a hint; the student's own state of study decides): ${d.admissionsStates.join(", ")}. Call get_admissions_sources with that state for the official pages.`,
    `For the user to open (do not read for content): Course Seeker ${d.userLinks.courseSeeker}${d.userLinks.admissionsCentres.map((c) => `, ${c.name} ${c.url}`).join("")}.`,
  ].join("\n");
}

export const withNotice = (body: string) =>
  `${body.trim()}\n\n${COURSE_NOTICE}`;
