import { z } from "zod";
import {
  inkview,
  inkviewResult,
  inkviewSource,
  tableMeta,
} from "./energy-common.js";
import { defineTool } from "../core/define-tool.js";
import { notFound, type Found } from "../core/grounded.js";
import {
  filterCourses,
  findCourse,
  type Catalogue,
} from "../courses/catalogue.js";
import { withCatalogue } from "../courses/index.js";
import { COURSE_NOTICE } from "../courses/notice.js";
import {
  couldMeet,
  evaluatePrerequisites,
  type PrereqResult,
} from "../courses/prerequisites.js";
import {
  COURSE_DATASETS,
  courseFound,
  courseMarkdown,
  figureText,
  latestSelectionRank,
  nextIntakeYear,
  notInIndex,
  resolveStudies,
  viewOf,
  withNotice,
  studyNamesSchemaNote,
  type CourseView,
} from "./course-common.js";

const entryYear = z
  .number()
  .int()
  .min(2025)
  .max(2035)
  .optional()
  .describe("Intake year the student is aiming for. Defaults to next year");
const base = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: COURSE_DATASETS,
} as const;

// ---------------------------------------------------------------- search_courses
interface Row {
  courseId: string;
  name: string;
  university: string;
  campuses: string[];
  depth: "curated" | "index_only";
  latestFigure?: {
    kind: string;
    label: string;
    value: number;
    intakeYear: number;
  };
  prerequisitesSummary?: string;
  prerequisitesCheck?: "could_be_met" | "cannot_check";
  officialUrl?: string;
  courseSearchUrl?: string;
}
interface SearchData {
  total: number;
  returned: number;
  nextCursor?: string;
  order: string;
  notes: string[];
  courses: Row[];
  notice: string;
}

export const searchCourses = defineTool({
  name: "search_courses",
  title: "Search Victorian university courses",
  description:
    "Finds Victorian university undergraduate courses by name or keyword, field, university and campus. Can keep only courses whose published prerequisites the student's VCE studies could meet (ignoring study scores), or whose latest lowest selection rank is at or below a figure. Each result says whether Ask Righto holds checked facts (curated) or only the course and its links (index_only). Entry figures are past results, not cut-offs.",
  inputSchema: z.object({
    query: z
      .string()
      .max(100)
      .optional()
      .describe("Part of a course name or a keyword, e.g. nursing"),
    field: z
      .string()
      .max(50)
      .optional()
      .describe("Field of study, e.g. engineering, law, science"),
    university: z
      .string()
      .max(80)
      .optional()
      .describe("University name or short name, e.g. RMIT or Monash"),
    campus: z
      .string()
      .max(60)
      .optional()
      .describe("Campus or location, e.g. Clayton"),
    vceStudies: z
      .array(z.string().max(80))
      .max(10)
      .optional()
      .describe(
        `The student's VCE studies (${studyNamesSchemaNote}). Keeps courses these could meet, ignoring scores`,
      ),
    figureAtMost: z
      .number()
      .min(0)
      .max(99.95)
      .optional()
      .describe(
        "Keep only courses whose latest lowest selection rank is at or below this",
      ),
    entryYear,
    orderBy: z
      .enum(["name", "figure"])
      .optional()
      .describe(
        "Order by name (default) or by latest lowest selection rank, only if the user asks",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Courses to return, default 20"),
    cursor: z
      .string()
      .max(10)
      .optional()
      .describe("Cursor from a previous result"),
  }),
  ...base,
  meta: tableMeta("data_table"),
  handler: (a) =>
    withCatalogue<SearchData>((cat) => {
      const year = a.entryYear ?? nextIntakeYear();
      let list = filterCourses(cat, a);
      const notes: string[] = [];
      if (a.vceStudies?.length) {
        const r = resolveStudies(a.vceStudies);
        if (!r.ok) return r.result;
        list = list.filter((c) => {
          if (c.depth === "index_only") return true;
          const pre =
            c.prerequisites.find((p) => p.appliesToYear === year) ??
            [...c.prerequisites].sort(
              (x, y) => y.appliesToYear - x.appliesToYear,
            )[0];
          return !pre || couldMeet(pre, r.value.studies);
        });
        notes.push(
          `Studies matched: ${r.value.echo.map((e) => e.study).join(", ")}. Study scores were not considered. Index-only courses cannot be checked and are kept.`,
        );
      }
      if (a.figureAtMost !== undefined) {
        list = list.filter(
          (c) => (latestSelectionRank(c)?.value ?? Infinity) <= a.figureAtMost!,
        );
        notes.push(
          `Only courses with a stored lowest selection rank at or below ${a.figureAtMost} are shown, using each course's latest stored intake year. Courses without that figure are left out.`,
        );
      }
      const order =
        a.orderBy === "figure"
          ? "latest lowest selection rank, lowest first (as asked)"
          : "course name";
      list = [...list].sort(
        (x, y) =>
          (a.orderBy === "figure"
            ? (latestSelectionRank(x)?.value ?? 1e9) -
              (latestSelectionRank(y)?.value ?? 1e9)
            : 0) ||
          x.name.localeCompare(y.name) ||
          x.id.localeCompare(y.id),
      );
      if (list.length === 0)
        return notFound(
          "not_in_dataset",
          "No courses in the Ask Righto index match those filters. Try fewer filters, or give the university's own course search to the user.",
          {
            filters: {
              query: a.query,
              field: a.field,
              university: a.university,
              campus: a.campus,
            },
          },
        );
      const limit = a.limit ?? 20;
      const start = a.cursor ? Math.max(0, parseInt(a.cursor, 10) || 0) : 0;
      const page = list.slice(start, start + limit);
      const views = page.map((c) => viewOf(cat, c, year).view);
      const rows: Row[] = views.map((v, i) => {
        const c = page[i]!;
        const fig =
          v.entryFigures?.filter(
            (f) => f.kind === "lowest_selection_rank",
          )[0] ?? v.entryFigures?.[0];
        return {
          courseId: v.courseId,
          name: v.name,
          university: v.university,
          campuses: v.campuses,
          depth: v.depth,
          ...(fig
            ? {
                latestFigure: {
                  kind: fig.kind,
                  label: fig.label,
                  value: fig.value,
                  intakeYear: fig.intakeYear,
                },
              }
            : {}),
          ...(v.prerequisites
            ? { prerequisitesSummary: v.prerequisites.text }
            : {}),
          ...(a.vceStudies?.length
            ? {
                prerequisitesCheck:
                  v.depth === "curated"
                    ? ("could_be_met" as const)
                    : ("cannot_check" as const),
              }
            : {}),
          ...(v.officialUrl ? { officialUrl: v.officialUrl } : {}),
          ...(v.courseSearchUrl ? { courseSearchUrl: v.courseSearchUrl } : {}),
        };
        void c;
      });
      const next =
        start + limit < list.length ? String(start + limit) : undefined;
      return courseFound(
        {
          total: list.length,
          returned: rows.length,
          ...(next ? { nextCursor: next } : {}),
          order,
          notes,
          courses: rows,
        } as Omit<SearchData, "notice">,
        views,
        cat,
      ) as Found<SearchData>;
    }),
  render: (d) =>
    withNotice(
      [
        `${d.returned} of ${d.total} courses, in order of ${d.order}.`,
        ...d.notes,
        ...d.courses.map(
          (c) =>
            `- ${c.name}, ${c.university}${c.campuses.length ? ` (${c.campuses.join(", ")})` : ""} [${c.depth === "curated" ? "checked facts held" : "index only: links, no facts"}]${c.latestFigure ? `. ${c.latestFigure.label}: ${c.latestFigure.value.toFixed(2)}` : ""}${c.prerequisitesSummary ? `. Prerequisites: ${c.prerequisitesSummary}` : ""}. id: ${c.courseId}. ${c.officialUrl ? `Official page: ${c.officialUrl}` : `Course search: ${c.courseSearchUrl}`}`,
        ),
        d.nextCursor ? `More results: cursor ${d.nextCursor}.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<SearchData>;
      return inkview.table(
        {
          title: "Victorian undergraduate courses",
          caption: COURSE_NOTICE,
          columns: [
            { key: "course", label: "Course" },
            { key: "university", label: "University" },
            { key: "depth", label: "Facts held", type: "badge" },
            { key: "figure", label: "Latest figure (kind and year)" },
            { key: "prereq", label: "Prerequisites" },
            { key: "link", label: "Official page", type: "link" },
          ],
          rows: r.data.courses.map((c) => ({
            course: c.name,
            university: c.university,
            depth: c.depth === "curated" ? "Checked facts" : "Index only",
            figure: c.latestFigure
              ? `${c.latestFigure.label}: ${c.latestFigure.value.toFixed(2)}`
              : "Not held: read the official page",
            prereq:
              c.prerequisitesSummary ?? "Not held: read the official page",
            link: c.officialUrl ?? c.courseSearchUrl ?? "",
          })),
          source: inkviewSource(r),
        },
        { limit: 50 },
      );
    }),
});

const SHORT: Record<string, string> = {
  lowest_selection_rank: "Lowest sel. rank",
  lowest_atar: "Lowest ATAR",
  guaranteed_atar: "Guaranteed ATAR",
  entry_threshold: "Entry threshold",
  median_atar: "Median ATAR",
};

// ---------------------------------------------------------------- get_course
export const getCourse = defineTool({
  name: "get_course",
  title: "Show one Victorian course",
  description:
    "Shows one course: our summary, every stored entry figure with its kind, intake year, source and checked date, prerequisites for the entry year asked, other selection criteria, campuses, codes and the official page. For a course Ask Righto only indexes, it returns the links and a reading checklist instead of facts, and says so. Use a courseId from search_courses.",
  inputSchema: z.object({
    courseId: z.string().max(120).describe("Course id from search_courses"),
    entryYear,
  }),
  ...base,
  meta: tableMeta("entity_card"),
  handler: (a) =>
    withCatalogue<CourseView & { notice: string; outcome: string }>((cat) => {
      const c = findCourse(cat, a.courseId);
      if (!c) return notInIndex(cat, a.courseId);
      const { view, warnings } = viewOf(
        cat,
        c,
        a.entryYear ?? nextIntakeYear(),
      );
      const out = courseFound(
        { ...view, outcome: view.depth },
        [view],
        cat,
        warnings,
      );
      return view.depth === "index_only"
        ? ({
            ...out,
            source: {
              ...out.source,
              name: `${view.university} course page and Ask Righto index`,
              url: view.officialUrl ?? out.source.url,
            },
          } as typeof out)
        : ({
            ...out,
            source: {
              ...out.source,
              name: `${view.university}, ${view.name}`,
              url: view.officialUrl ?? out.source.url,
            },
          } as typeof out);
    }),
  render: (v) => withNotice(courseMarkdown(v)),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CourseView>;
      const v = r.data;
      return inkview.entityCard({
        name: v.name,
        kind: "organization",
        tagline: `${v.university}${v.campuses.length ? `, ${v.campuses.join(", ")}` : ""}`,
        description: v.summary ?? v.message,
        facts: [
          ...(v.entryFigures ?? [])
            .slice(0, 4)
            .map((f) => ({
              label: `${SHORT[f.kind] ?? "Entry figure"} ${f.intakeYear}`,
              value: `${f.value.toFixed(2)}: ${f.label}`.slice(0, 200),
            })),
          ...(v.prerequisites
            ? [
                {
                  label: `Prerequisites ${v.prerequisites.appliesToYear}`,
                  value: v.prerequisites.text.slice(0, 200),
                },
              ]
            : []),
          ...(v.depth === "index_only"
            ? [{ label: "Facts held", value: "None: read the official page" }]
            : []),
        ].slice(0, 8),
        links: [
          v.officialUrl
            ? { label: "Official page", url: v.officialUrl }
            : undefined,
          v.courseSeekerUrl
            ? { label: "Course Seeker", url: v.courseSeekerUrl }
            : undefined,
        ].filter((x): x is { label: string; url: string } => !!x),
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- compare_courses
interface CompareData {
  courses: CourseView[];
  notes: string[];
  notice: string;
}
const CMP = [
  "University",
  "Campus",
  "Duration",
  "Entry figures (kind and year)",
  "Prerequisites",
  "Other selection criteria",
];
const cell = (v: CourseView, i: number): string => {
  if (i === 0) return v.university;
  if (i === 1) return v.campuses.join(", ") || "Not held";
  if (i === 2)
    return v.durationYears ? `${v.durationYears} years full-time` : "Not held";
  if (v.depth === "index_only") return "cannot_check: read the official page";
  if (i === 3)
    return (
      (v.entryFigures ?? []).map(figureText).join("; ").slice(0, 190) ||
      "Not stored"
    );
  if (i === 4)
    return (
      v.prerequisites
        ? `${v.prerequisites.appliesToYear}: ${v.prerequisites.text}`
        : "Not stored"
    ).slice(0, 190);
  return (
    (v.otherCriteria ?? [])
      .map((o) => o.label)
      .join("; ")
      .slice(0, 190) || "Not stored"
  );
};

export const compareCourses = defineTool({
  name: "compare_courses",
  title: "Compare Victorian courses",
  description:
    "Shows two to five courses side by side on the same fields: university, campus, duration, entry figures with kind and year, prerequisites, other selection criteria and official page. It does not pick a winner. Index-only courses show cannot_check with their links.",
  inputSchema: z.object({
    courseIds: z
      .array(z.string().max(120))
      .min(1)
      .max(12)
      .describe("Two to five course ids from search_courses"),
    entryYear,
  }),
  ...base,
  meta: tableMeta("comparison"),
  handler: (a) =>
    withCatalogue<CompareData>((cat) => {
      if (a.courseIds.length < 2 || a.courseIds.length > 5)
        return notFound(
          "needs_input",
          "Compare two to five courses; at most five can be compared at once.",
        );
      const views: CourseView[] = [];
      const warnings: string[] = [];
      for (const id of a.courseIds) {
        const c = findCourse(cat, id);
        if (!c) return notInIndex(cat, id);
        const r = viewOf(cat, c, a.entryYear ?? nextIntakeYear());
        views.push(r.view);
        warnings.push(...r.warnings.map((w) => `${c.name}: ${w}`));
      }
      const years = new Set(
        views.flatMap((v) =>
          (v.entryFigures ?? [])
            .filter((f) => f.kind === "lowest_selection_rank")
            .slice(0, 1)
            .map((f) => f.intakeYear),
        ),
      );
      const notes =
        years.size > 1
          ? [
              "The latest figures are from different intake years; each figure shows its own year.",
            ]
          : [];
      return courseFound(
        { courses: views, notes } as Omit<CompareData, "notice">,
        views,
        cat,
        [...notes, ...warnings],
      ) as Found<CompareData>;
    }),
  render: (d) =>
    withNotice(
      [
        `| | ${d.courses.map((c) => `${c.name} (${c.depth === "curated" ? "checked" : "index only"})`).join(" | ")} |`,
        `|---|${d.courses.map(() => "---").join("|")}|`,
        ...CMP.map(
          (label, i) =>
            `| ${label} | ${d.courses.map((c) => cell(c, i).replace(/\|/g, "/")).join(" | ")} |`,
        ),
        `| Official page | ${d.courses.map((c) => c.officialUrl ?? c.courseSearchUrl ?? "").join(" | ")} |`,
      ].join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CompareData>;
      return inkview.comparison({
        title: "Course comparison (no winner is picked)",
        items: r.data.courses.map((c) => ({
          name: c.name.slice(0, 80),
          subtitle: c.university.slice(0, 120),
          ...(c.officialUrl ? { url: c.officialUrl } : {}),
        })),
        criteria: CMP,
        values: r.data.courses.map((c) =>
          CMP.map((_, i) => cell(c, i).slice(0, 200)),
        ),
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- check_course_prerequisites
interface CheckRow {
  courseId: string;
  name: string;
  university: string;
  depth: "curated" | "index_only";
  result: "met" | "not_met" | "needs_scores" | "cannot_check";
  appliesToYear?: number;
  missing: string[];
  scoresNeeded: string[];
  otherCriteria: string[];
  officialUrl?: string;
  courseSeekerUrl?: string;
  readingChecklist?: readonly string[];
  note?: string;
}
interface CheckData {
  studiesMatched: Array<{ input: string; study: string; score?: number }>;
  outcome: string;
  courses: CheckRow[];
  notice: string;
}

export const checkCoursePrerequisites = defineTool({
  name: "check_course_prerequisites",
  title: "Check course prerequisites",
  description:
    "For up to ten courses, checks the published VCE prerequisites against the student's studies and, if given, expected study scores. Per course it says met, not_met (and what is missing), needs_scores (and the minimum scores), or cannot_check for a course Ask Righto only indexes. Selection criteria such as a folio or interview are listed, not checked. Studies and scores are used for this call only and never stored. Do not ask for the student's name, school or age.",
  inputSchema: z.object({
    courseIds: z
      .array(z.string().max(120))
      .min(1)
      .max(25)
      .describe("One to ten course ids"),
    vceStudies: z
      .array(z.string().max(80))
      .min(1)
      .max(12)
      .describe(`The student's VCE studies (${studyNamesSchemaNote})`),
    studyScores: z
      .array(z.number().min(0).max(50))
      .max(12)
      .optional()
      .describe(
        "Expected study scores, in the same order as vceStudies. Leave out if not given",
      ),
    eal: z
      .boolean()
      .optional()
      .describe("True if the student sits English as an Additional Language"),
    entryYear,
  }),
  ...base,
  meta: tableMeta("data_table"),
  handler: (a) =>
    withCatalogue<CheckData>((cat) => {
      if (a.courseIds.length > 10)
        return notFound("needs_input", "Check at most ten courses at a time.");
      const r = resolveStudies(a.vceStudies, a.studyScores);
      if (!r.ok) return r.result;
      const year = a.entryYear ?? nextIntakeYear();
      const views: CourseView[] = [];
      const rows: CheckRow[] = [];
      const warnings: string[] = [];
      for (const id of a.courseIds) {
        const c = findCourse(cat, id);
        if (!c) return notInIndex(cat, id);
        const { view, warnings: w } = viewOf(cat, c, year);
        views.push(view);
        const head = {
          courseId: view.courseId,
          name: view.name,
          university: view.university,
          depth: view.depth,
          ...(view.officialUrl ? { officialUrl: view.officialUrl } : {}),
          ...(view.courseSeekerUrl
            ? { courseSeekerUrl: view.courseSeekerUrl }
            : {}),
        };
        if (view.depth === "index_only" || !view.prerequisites) {
          rows.push({
            ...head,
            result: "cannot_check",
            missing: [],
            scoresNeeded: [],
            otherCriteria: [],
            ...(view.depth === "index_only"
              ? { readingChecklist: view.readingChecklist }
              : {}),
            note:
              view.depth === "index_only"
                ? view.message
                : "No prerequisites are stored for this course.",
          });
          continue;
        }
        warnings.push(...w.map((x) => `${c.name}: ${x}`));
        const ev: PrereqResult = evaluatePrerequisites(
          view.prerequisites,
          r.value.studies,
          a.eal ?? false,
        );
        rows.push({
          ...head,
          result: ev.status,
          appliesToYear: view.prerequisites.appliesToYear,
          missing: ev.missing,
          scoresNeeded: ev.scoresNeeded,
          otherCriteria: (view.otherCriteria ?? [])
            .filter((o) => o.kind !== "none")
            .map((o) => o.label),
        });
      }
      const outcome = rows.some((x) => x.result === "cannot_check")
        ? "cannot_check"
        : "found";
      return courseFound(
        {
          studiesMatched: r.value.echo.map((e) => ({
            input: e.input,
            study: e.study,
            ...(e.score !== undefined ? { score: e.score } : {}),
          })),
          outcome,
          courses: rows,
        } as Omit<CheckData, "notice">,
        views,
        cat,
        warnings,
      ) as Found<CheckData>;
    }),
  render: (d) =>
    withNotice(
      [
        `Studies matched: ${d.studiesMatched.map((s) => `${s.study}${s.score !== undefined ? ` ${s.score}` : ""}`).join(", ")}.`,
        ...d.courses.map(
          (c) =>
            `- ${c.name}, ${c.university}: ${c.result}${c.missing.length ? `. Missing: ${c.missing.join("; ")}` : ""}${c.scoresNeeded.length ? `. Minimum scores to check: ${c.scoresNeeded.join("; ")}` : ""}${c.otherCriteria.length ? `. Also: ${c.otherCriteria.join("; ")} (not checked)` : ""}${c.result === "cannot_check" ? `. Read the official page: ${c.officialUrl ?? ""}${c.courseSeekerUrl ? ` or Course Seeker ${c.courseSeekerUrl}` : ""}` : ""}`,
        ),
      ].join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CheckData>;
      return inkview.table({
        title: "Prerequisite check",
        caption: COURSE_NOTICE,
        columns: [
          { key: "course", label: "Course" },
          { key: "university", label: "University" },
          { key: "result", label: "Result", type: "badge" },
          { key: "detail", label: "Missing or needed" },
          { key: "link", label: "Official page", type: "link" },
        ],
        rows: r.data.courses.map((c) => ({
          course: c.name,
          university: c.university,
          result: c.result,
          detail:
            [...c.missing, ...c.scoresNeeded].join("; ") ||
            (c.result === "cannot_check" ? "Read the official page" : ""),
          link: c.officialUrl ?? "",
        })),
        source: inkviewSource(r),
      });
    }),
});

export type { Catalogue };
