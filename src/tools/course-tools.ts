import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { filterCourses, findCourse } from "../courses/catalogue.js";
import { withCatalogue } from "../courses/index.js";
import { AGGREGATE_NOTICE } from "../courses/notice.js";
import {
  COMPARABILITY_NOTICE,
  STATE_INFO,
  STATES,
  TOPICS,
  UNVERIFIED_WARNING,
  sourcesFor,
} from "../courses/sources.js";
import { REGIONS } from "../courses/types.js";
import {
  COURSE_DATASETS,
  courseFound,
  courseLine,
  detailMarkdown,
  detailOf,
  notInIndex,
  viewOf,
  withNotice,
  type CourseDetail,
  type CourseView,
} from "./course-common.js";

const base = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: COURSE_DATASETS,
} as const;

// ---------------------------------------------------------------- search_domestic_courses
interface SearchData {
  total: number;
  returned: number;
  nextCursor?: string;
  courses: CourseView[];
  notes: string[];
  notice: string;
}

export const searchCourses = defineTool({
  name: "search_domestic_courses",
  title: "Search university courses",
  description:
    "Finds undergraduate courses in the CRICOS index by name or keyword, university, campus and state group. Returns the course, university, campuses, duration, CRICOS code and the university's own link. It holds no entry figures or prerequisites: the assistant reads those from the university's page. Domestic-only courses may be missing because CRICOS lists courses registered for international students.",
  inputSchema: z.object({
    query: z.string().max(100).optional().describe("Part of a course name or a keyword, e.g. nursing"),
    university: z.string().max(80).optional().describe("University name or short name, e.g. RMIT or Monash"),
    campus: z.string().max(60).optional().describe("Campus or location, e.g. Clayton"),
    region: z
      .enum(REGIONS)
      .optional()
      .describe("vic (VTAC universities), nsw-act (UAC universities) or qld (QTAC universities). Leave out to search all"),
    limit: z.number().int().min(1).max(50).optional().describe("Courses to return, default 20"),
    cursor: z.string().max(10).optional().describe("Cursor from a previous result"),
  }),
  ...base,
  handler: (a) =>
    withCatalogue<SearchData>((cat) => {
      const list = filterCourses(cat, a).sort(
        (x, y) => x.name.localeCompare(y.name) || x.id.localeCompare(y.id),
      );
      if (list.length === 0) {
        const prov = a.university
          ? cat.providers.find((p) =>
              p.name.toLowerCase().includes(a.university!.toLowerCase()),
            )
          : undefined;
        return notFound(
          "not_in_dataset",
          `No course in the Ask Righto CRICOS index matches those filters. CRICOS lists courses registered for international students, so a domestic-only course can be missing. Try fewer filters, or give the user the university's own course search.${prov ? ` For ${prov.name}: ${prov.searchUrl ?? prov.coursesUrl}` : ""}`,
          { filters: { query: a.query, university: a.university, campus: a.campus } },
        );
      }
      const limit = a.limit ?? 20;
      const start = a.cursor ? Math.max(0, parseInt(a.cursor, 10) || 0) : 0;
      const page = list.slice(start, start + limit).map((c) => viewOf(cat, c));
      const next = start + limit < list.length ? String(start + limit) : undefined;
      return courseFound(
        {
          total: list.length,
          returned: page.length,
          ...(next ? { nextCursor: next } : {}),
          courses: page,
          notes: [
            "Rows come from the CRICOS index only. For entry figures and prerequisites, read the university's page (see get_domestic_course).",
          ],
        } as Omit<SearchData, "notice">,
        cat,
      );
    }),
  render: (d) =>
    withNotice(
      [
        `${d.returned} of ${d.total} courses (CRICOS index, by name).`,
        ...d.notes,
        ...d.courses.map((c) => `- ${courseLine(c)}`),
        d.nextCursor ? `More results: cursor ${d.nextCursor}.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
});

// ---------------------------------------------------------------- get_domestic_course
export const getCourse = defineTool({
  name: "get_domestic_course",
  title: "Show one university course",
  description:
    "Shows one CRICOS index row with the university's own link and a reading checklist. It holds no entry figures or prerequisites: the assistant reads them from the university's course page, quotes them with the link and time read, and labels them as read by the assistant. Use a courseId from search_domestic_courses.",
  inputSchema: z.object({
    courseId: z.string().max(120).describe("Course id from search_domestic_courses"),
  }),
  ...base,
  handler: (a) =>
    withCatalogue<CourseDetail & { notice: string }>((cat) => {
      const c = findCourse(cat, a.courseId);
      if (!c) return notInIndex(cat, a.courseId);
      return courseFound(detailOf(cat, c), cat);
    }),
  render: (d) => withNotice(detailMarkdown(d)),
});

// ---------------------------------------------------------------- get_admissions_sources
const topic = z.enum([...TOPICS, "all"]);

export const getAdmissionsSources = defineTool({
  name: "get_admissions_sources",
  title: "Find admissions pages for a state",
  description:
    "Gives the official pages to read for one state's university admissions: scaling (the most recent report), how the ATAR is calculated, key dates, preferences and offers, early entry, adjustment or bonus schemes and subject rules, each with a reading checklist. State is vic (VTAC and the VCE), nsw (UAC and the HSC), act (UAC and the ACT certificate) or qld (QTAC and the QCE). It returns links only: Ask Righto holds no scaled scores, dates or aggregate estimates, so the assistant reads the page and does any arithmetic the page defines itself.",
  inputSchema: z.object({
    state: z.enum(STATES).optional().describe("The state the student studies senior secondary in: vic, nsw, act or qld. Ask the student if unknown."),
    topic: topic.optional().describe("What to find: scaling, atar-rules, key-dates, preferences, early-entry, adjustment-factors, subject-rules or all (default)"),
  }),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["admissions-links"] as const,
  handler: (a) => {
    if (!a.state)
      return notFound(
        "needs_input",
        "Which state's admissions system applies: Victoria (VTAC), NSW (UAC), the ACT (UAC) or Queensland (QTAC)? It depends on where the student studies senior secondary, not on where they live now or which university they want. Ask the student, then call again with state.",
        { states: [...STATES] },
      );
    const info = STATE_INFO[a.state];
    const sources = sourcesFor(a.state, a.topic ?? "all");
    const unverified = sources.some((s) => !s.checkedOn);
    const asOf = sources.map((s) => s.checkedOn ?? s.indexedOn).sort()[0]!;
    return found({
      data: {
        state: info,
        sources,
        rules:
          "Read the page, then quote only the checklist items with the page link and the time you read them, labelled as read by the assistant. Never send what you read back to an Ask Righto tool. Stop at a bot check or login. " +
          AGGREGATE_NOTICE +
          " " +
          COMPARABILITY_NOTICE,
        notice: "Links only: Ask Righto has not read these pages and stores nothing from them. General information, not advice.",
      },
      source: {
        name: `${info.centre} and ${info.authority} official pages (links only)`,
        url: sources[0]?.url ?? info.centreUrl,
        licence: "Links only; Ask Righto stores no content from these sites",
      },
      asOf: `${asOf}T00:00:00Z`,
      warnings: unverified ? [UNVERIFIED_WARNING] : [],
    });
  },
  render: (d) =>
    [
      `${d.state.stateName}: apply through ${d.state.centre} (${d.state.centreUrl}); certificate ${d.state.certificate} (${d.state.authority}). Entry figures here are named: ${d.state.figureKinds.join(", ")} (names as indexed, not confirmed).`,
      ...d.sources.map(
        (s) =>
          `- ${s.title} (${s.publisher}): ${s.url}\n  Read: ${s.readingChecklist.map((x, i) => `${i + 1}) ${x}`).join("; ")}`,
      ),
      d.rules,
      d.notice,
    ].join("\n"),
});
