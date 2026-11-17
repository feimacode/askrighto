/** Shared pieces of the course and planning tools: views by depth, source building, study resolution, markdown. */
import type { Found, NotFound } from "../core/grounded.js";
import { found, notFound, type Source } from "../core/grounded.js";
import { attributionFor } from "../core/rights.js";
import {
  findCourse,
  providerOf,
  type Catalogue,
} from "../courses/catalogue.js";
import {
  BROWSING_RULES,
  COURSE_NOTICE,
  CRITERION_LABEL,
  FIGURE_LABEL,
  READING_CHECKLIST,
} from "../courses/notice.js";
import { matchStudy, loadStudies, type Study } from "../courses/studies.js";
import type { StudentStudy } from "../courses/prerequisites.js";
import type { Course, Rule } from "../courses/types.js";

export const COURSE_DATASETS = ["vic-courses"] as const;
export const OWN_WORDS = "Facts in our own words; see the official page";
export const INDEX_SOURCE_URL =
  "https://github.com/feimacode/askrighto/tree/main/data/courses/vic";

/** The intake year a student starting now is aiming at: next calendar year. */
export const nextIntakeYear = (now: Date = new Date()) =>
  now.getUTCFullYear() + 1;

export interface FigureView {
  kind: string;
  label: string;
  value: number;
  intakeYear: number;
  campus?: string;
  sourceUrl: string;
  checkedOn: string;
}
export interface PrerequisiteView {
  appliesToYear: number;
  requestedYear: number;
  text: string;
  rules: Rule[];
  sourceUrl: string;
  checkedOn: string;
}
export interface CourseView {
  depth: "curated" | "index_only";
  courseId: string;
  name: string;
  university: string;
  level: string;
  fields: string[];
  campuses: string[];
  durationYears?: number;
  cricosCode?: string;
  vtacCode?: string;
  officialUrl?: string;
  courseSeekerUrl?: string;
  courseSearchUrl?: string;
  summary?: string;
  entryFigures?: FigureView[];
  prerequisites?: PrerequisiteView;
  otherCriteria?: Array<{ kind: string; label: string; note?: string }>;
  message?: string;
  readingChecklist?: readonly string[];
  browsingRules?: string;
}

export const INDEX_ONLY_MESSAGE =
  "Ask Righto holds no checked facts (entry figures, prerequisites) for this course. The official page decides; use the links and the reading checklist below.";

export function viewOf(
  cat: Catalogue,
  c: Course,
  entryYear: number,
): { view: CourseView; warnings: string[] } {
  const prov = providerOf(cat, c);
  const base = {
    courseId: c.id,
    name: c.name,
    university: prov?.name ?? c.providerId,
    level: c.level,
    fields: c.fields,
    campuses: c.campuses,
    ...(c.durationYears !== undefined
      ? { durationYears: c.durationYears }
      : {}),
    ...(c.cricosCode ? { cricosCode: c.cricosCode } : {}),
    ...(c.vtacCode ? { vtacCode: c.vtacCode } : {}),
    ...(c.officialUrl ? { officialUrl: c.officialUrl } : {}),
    ...(c.courseSeekerUrl ? { courseSeekerUrl: c.courseSeekerUrl } : {}),
  };
  const search = !c.officialUrl
    ? { courseSearchUrl: prov?.searchUrl ?? prov?.coursesUrl }
    : {};
  if (
    c.depth === "index_only" ||
    (c.entryFigures.length === 0 && c.prerequisites.length === 0 && !c.summary)
  ) {
    return {
      view: {
        depth: "index_only",
        ...base,
        ...search,
        message: INDEX_ONLY_MESSAGE,
        readingChecklist: READING_CHECKLIST,
        browsingRules: BROWSING_RULES,
      },
      warnings: [],
    };
  }
  const warnings: string[] = [];
  const figs = [...c.entryFigures].sort(
    (a, b) => b.intakeYear - a.intakeYear || a.kind.localeCompare(b.kind),
  );
  const exact = c.prerequisites.find((p) => p.appliesToYear === entryYear);
  const earlier = [...c.prerequisites]
    .filter((p) => p.appliesToYear < entryYear)
    .sort((a, b) => b.appliesToYear - a.appliesToYear)[0];
  const pre = exact ?? earlier;
  if (!exact && pre)
    warnings.push(
      `Prerequisites for ${entryYear} entry are not held yet; the ${pre.appliesToYear} prerequisites are shown. Check the official page for ${entryYear}.`,
    );
  if (!pre && c.prerequisites.length === 0)
    warnings.push(
      "No prerequisites are stored for this course. Check the official page.",
    );
  const view: CourseView = {
    depth: "curated",
    ...base,
    ...search,
    ...(c.summary ? { summary: c.summary } : {}),
    entryFigures: figs.map((f) => ({
      kind: f.kind,
      label: FIGURE_LABEL[f.kind](f.intakeYear),
      value: f.value,
      intakeYear: f.intakeYear,
      ...(f.campus ? { campus: f.campus } : {}),
      sourceUrl: f.sourceUrl,
      checkedOn: f.checkedOn,
    })),
    ...(pre
      ? {
          prerequisites: {
            appliesToYear: pre.appliesToYear,
            requestedYear: entryYear,
            text: pre.text,
            rules: pre.rules,
            sourceUrl: pre.sourceUrl,
            checkedOn: pre.checkedOn,
          },
        }
      : {}),
    otherCriteria: c.otherCriteria.map((o) => ({
      kind: o.kind,
      label: CRITERION_LABEL[o.kind],
      ...(o.note ? { note: o.note } : {}),
    })),
  };
  return { view, warnings };
}

/** The latest lowest selection rank, if the course has one. */
export function latestSelectionRank(
  c: Course,
): { value: number; intakeYear: number } | undefined {
  const f = c.entryFigures
    .filter((x) => x.kind === "lowest_selection_rank")
    .sort((a, b) => b.intakeYear - a.intakeYear || a.value - b.value)[0];
  return f ? { value: f.value, intakeYear: f.intakeYear } : undefined;
}

/** The oldest checked date among the facts a view shows, or the load time. */
export function asOfFor(views: CourseView[], cat: Catalogue): string {
  const dates: string[] = [];
  for (const v of views) {
    if (v.depth !== "curated") continue;
    dates.push(...(v.entryFigures ?? []).map((f) => f.checkedOn));
    if (v.prerequisites) dates.push(v.prerequisites.checkedOn);
  }
  dates.sort();
  return dates[0] ? `${dates[0]}T00:00:00Z` : cat.loadedAt.toISOString();
}

export function indexSource(views: CourseView[], cat: Catalogue): Source {
  const usesCricos = views.some((v) => findCourse(cat, v.courseId)?.fromCricos);
  const attribution = usesCricos ? attributionFor(["cricos-register"]) : undefined;
  return {
    name: "Ask Righto Victorian course index (universities' own pages, CRICOS)",
    url: INDEX_SOURCE_URL,
    licence: usesCricos
      ? `${OWN_WORDS}; CRICOS fields CC BY 2.5 AU`
      : OWN_WORDS,
    ...(attribution ? { attribution } : {}),
  };
}

export function courseFound<T extends object>(
  data: T,
  views: CourseView[],
  cat: Catalogue,
  warnings: string[] = [],
  source?: Source,
): Found<T & { notice: string }> {
  return found({
    data: { ...data, notice: COURSE_NOTICE },
    source: source ?? indexSource(views, cat),
    asOf: asOfFor(views, cat),
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

export interface ResolvedStudies {
  studies: StudentStudy[];
  echo: Array<{
    input: string;
    study: string;
    studyId: string;
    score?: number;
  }>;
}

/** Matches study names (and parallel scores). Unknown or ambiguous names return needs_input with candidates. */
export function resolveStudies(
  names: readonly string[],
  scores?: readonly number[],
): { ok: true; value: ResolvedStudies } | { ok: false; result: NotFound } {
  if (scores && scores.length !== names.length) {
    return {
      ok: false,
      result: notFound(
        "needs_input",
        `studyScores has ${scores.length} values but vceStudies has ${names.length}. Scores must follow the order of the studies, one per study.`,
      ),
    };
  }
  const cat = loadStudies();
  const out: ResolvedStudies = { studies: [], echo: [] };
  const seen = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const m = matchStudy(names[i]!, cat);
    if (!m.ok) {
      const c = m.candidates.map((s: Study) => s.name);
      return {
        ok: false,
        result: notFound(
          "needs_input",
          `"${names[i]}" ${c.length ? "matches more than one VCE study or none exactly" : "is not a VCE study name Ask Righto knows"}. ${c.length ? `Did the student mean: ${c.join("; ")}?` : "Ask the student for the VCAA study name."}`,
          { input: names[i], candidates: c },
        ),
      };
    }
    if (seen.has(m.study.id)) continue;
    seen.add(m.study.id);
    const score = scores?.[i];
    out.studies.push({
      studyId: m.study.id,
      ...(score !== undefined ? { score } : {}),
    });
    out.echo.push({
      input: names[i]!,
      study: m.study.name,
      studyId: m.study.id,
      ...(score !== undefined ? { score } : {}),
    });
  }
  return { ok: true, value: out };
}

export const studyNamesSchemaNote =
  "VCAA study names or common short names such as Methods, Spesh or Lit";

export function figureText(f: FigureView): string {
  return `${f.label}: ${f.value.toFixed(2)}${f.campus ? ` (${f.campus})` : ""}`;
}

/** Markdown for one course view. */
export function courseMarkdown(v: CourseView, heading = true): string {
  const lines: string[] = [];
  lines.push(
    `${heading ? "### " : ""}${v.name}, ${v.university} (${v.depth === "curated" ? "checked facts held" : "index only"})`,
  );
  const meta = [
    v.campuses.length ? `Campus: ${v.campuses.join(", ")}` : "",
    v.durationYears ? `Duration: ${v.durationYears} years full-time` : "",
    v.cricosCode ? `CRICOS: ${v.cricosCode}` : "",
    v.vtacCode ? `VTAC code: ${v.vtacCode}` : "",
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(". "));
  if (v.summary) lines.push(v.summary);
  if (v.depth === "curated") {
    for (const f of v.entryFigures ?? [])
      lines.push(
        `- ${figureText(f)}. Source: ${f.sourceUrl}, checked ${f.checkedOn}.`,
      );
    if (v.prerequisites)
      lines.push(
        `- Prerequisites for ${v.prerequisites.appliesToYear} entry: ${v.prerequisites.text} (source ${v.prerequisites.sourceUrl}, checked ${v.prerequisites.checkedOn}).`,
      );
    for (const o of v.otherCriteria ?? [])
      lines.push(`- ${o.label}${o.note ? `: ${o.note}` : ""}.`);
  } else {
    lines.push(v.message ?? INDEX_ONLY_MESSAGE);
    lines.push(
      "Read on the official page: " +
        (v.readingChecklist ?? []).map((x, i) => `${i + 1}) ${x}`).join("; ") +
        ".",
    );
    lines.push(`How to read it: ${v.browsingRules}`);
  }
  const links = [
    v.officialUrl ? `Official page: ${v.officialUrl}` : "",
    v.courseSeekerUrl ? `Course Seeker: ${v.courseSeekerUrl}` : "",
    v.courseSearchUrl ? `University course search: ${v.courseSearchUrl}` : "",
  ].filter(Boolean);
  if (links.length) lines.push(links.join(". "));
  return lines.join("\n");
}

export const withNotice = (body: string) =>
  `${body.trim()}\n\n${COURSE_NOTICE}`;
