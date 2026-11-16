import { z } from "zod";
import {
  inkview,
  inkviewResult,
  inkviewSource,
  tableMeta,
} from "./energy-common.js";
import { defineTool } from "../core/define-tool.js";
import {
  found,
  notFound,
  type Found,
  type Grounded,
} from "../core/grounded.js";
import { withIntl } from "../intl/index.js";
import {
  CRICOS_SOURCE,
  FEE_LABEL,
  INTL_BROWSING_RULES,
  INTL_NO_ADVICE,
  INTL_NOTICE,
  INTL_READING_CHECKLIST,
  YEARLY_LABEL,
} from "../intl/notice.js";
import { LEVEL_GROUPS, type IntlCourse, type IntlData } from "../intl/types.js";

const base = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["intl-courses"] as const,
} as const;

const aud = (n: number) => `AUD ${Math.round(n).toLocaleString("en-AU")}`;
const lower = (s: string | undefined) => (s ?? "").toLowerCase();
const withNotice = (t: string) => `${t}\n\n${INTL_NOTICE}`;

/** Total fee over duration, only when both are published. */
export function yearlyFee(c: IntlCourse): number | undefined {
  return c.tuitionFeeTotal !== undefined && c.durationWeeks
    ? Math.round(c.tuitionFeeTotal / (c.durationWeeks / 52))
    : undefined;
}

export interface IntlView {
  cricosCode: string;
  name: string;
  provider: string;
  providerWebsite?: string;
  level: string;
  field?: string;
  durationWeeks?: number;
  tuitionFeeTotal?: number;
  feeNote: string;
  yearlyFee?: number;
  yearlyFeeNote?: string;
  nonTuitionFee?: number;
  language?: string;
  workComponent?: boolean;
  expired: boolean;
  locations: string[];
  domesticCourseId?: string;
}

function viewOf(d: IntlData, c: IntlCourse): IntlView {
  const p = d.providers.find((x) => x.id === c.providerId);
  const y = yearlyFee(c);
  return {
    cricosCode: c.cricosCode,
    name: c.name,
    provider: p?.name ?? c.providerId,
    ...(p?.website ? { providerWebsite: p.website } : {}),
    level: c.level,
    ...(c.field ? { field: c.field } : {}),
    ...(c.durationWeeks !== undefined
      ? { durationWeeks: c.durationWeeks }
      : {}),
    ...(c.tuitionFeeTotal !== undefined
      ? { tuitionFeeTotal: c.tuitionFeeTotal }
      : {}),
    feeNote:
      c.tuitionFeeTotal !== undefined
        ? `${FEE_LABEL}, file dated ${d.sourceDate.toISOString().slice(0, 10)}`
        : "Not published in CRICOS",
    ...(y !== undefined ? { yearlyFee: y, yearlyFeeNote: YEARLY_LABEL } : {}),
    ...(c.nonTuitionFee !== undefined
      ? { nonTuitionFee: c.nonTuitionFee }
      : {}),
    ...(c.language ? { language: c.language } : {}),
    ...(c.workComponent !== undefined
      ? { workComponent: c.workComponent }
      : {}),
    expired: c.expired,
    locations: c.locations.map((l) =>
      l.state ? `${l.campus} (${l.state})` : l.campus,
    ),
    ...(c.domesticCourseId ? { domesticCourseId: c.domesticCourseId } : {}),
  };
}

const okResult = <T extends object>(
  d: IntlData,
  data: T,
  warnings: string[] = [],
): Found<T & { notice: string }> =>
  found({
    data: { ...data, notice: INTL_NOTICE },
    source: { ...CRICOS_SOURCE },
    asOf: d.sourceDate,
    warnings,
  });

const expiredWarning = (v: IntlView) =>
  v.expired
    ? [`${v.name} (${v.cricosCode}) is marked as expired in CRICOS.`]
    : [];

function notInDataset(code: string): Grounded<never> {
  return notFound(
    "not_in_dataset",
    `No course with CRICOS code "${code}" is in the Ask Righto international index. Use search_intl_courses to find the code.`,
    { cricosCode: code },
  );
}
const findByCode = (d: IntlData, code: string) =>
  d.courses.find(
    (c) => c.cricosCode.toLowerCase() === code.trim().toLowerCase(),
  );

// ---------------------------------------------------------------- search_intl_courses
interface SearchData {
  total: number;
  returned: number;
  nextCursor?: string;
  matchesWithoutPublishedFee: number;
  notes: string[];
  courses: IntlView[];
  notice: string;
}

export const searchIntlCourses = defineTool({
  name: "search_intl_courses",
  title: "Search courses for international students",
  description:
    "Finds higher-education courses registered for international students in Australia (CRICOS) by name or keyword, level, field, state, campus, provider, maximum total tuition fee and maximum duration. Fees are indicative, as published in CRICOS, and some courses have none published. Expired courses are left out. It gives course facts only, no visa or migration advice.",
  inputSchema: z.object({
    query: z
      .string()
      .max(100)
      .optional()
      .describe("Part of a course or provider name, e.g. data science"),
    level: z.enum(LEVEL_GROUPS).optional().describe("Course level"),
    field: z
      .string()
      .max(60)
      .optional()
      .describe("Field of education, e.g. information technology"),
    state: z
      .string()
      .max(3)
      .optional()
      .describe("State or territory code, e.g. VIC"),
    campus: z
      .string()
      .max(60)
      .optional()
      .describe("Campus or city, e.g. Parkville"),
    provider: z
      .string()
      .max(80)
      .optional()
      .describe("Provider name, e.g. Test University"),
    maxTotalFee: z
      .number()
      .min(0)
      .max(1_000_000)
      .optional()
      .describe(
        "Maximum total tuition fee in AUD; courses with no published fee are not counted as under it",
      ),
    maxDurationWeeks: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Maximum duration in weeks"),
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
    withIntl<SearchData>((d) => {
      const words = lower(a.query).split(/\s+/).filter(Boolean);
      let list = d.courses.filter((c) => !c.expired);
      const prov = (c: IntlCourse) =>
        lower(d.providers.find((p) => p.id === c.providerId)?.name);
      if (words.length)
        list = list.filter((c) =>
          words.every((w) => lower(c.name).includes(w) || prov(c).includes(w)),
        );
      if (a.level) list = list.filter((c) => c.levelGroup === a.level);
      if (a.field)
        list = list.filter((c) => lower(c.field).includes(lower(a.field)));
      if (a.state)
        list = list.filter((c) =>
          c.locations.some(
            (l) => l.state.toLowerCase() === a.state!.toLowerCase(),
          ),
        );
      if (a.campus)
        list = list.filter((c) =>
          c.locations.some((l) => lower(l.campus).includes(lower(a.campus))),
        );
      if (a.provider)
        list = list.filter((c) => prov(c).includes(lower(a.provider)));
      if (a.maxDurationWeeks !== undefined)
        list = list.filter(
          (c) =>
            c.durationWeeks !== undefined &&
            c.durationWeeks <= a.maxDurationWeeks!,
        );
      const notes: string[] = [];
      let withoutFee = 0;
      if (a.maxTotalFee !== undefined) {
        withoutFee = list.filter((c) => c.tuitionFeeTotal === undefined).length;
        list = list.filter(
          (c) =>
            c.tuitionFeeTotal !== undefined &&
            c.tuitionFeeTotal <= a.maxTotalFee!,
        );
        notes.push(
          `Only courses with a published total tuition fee at or below ${aud(a.maxTotalFee)} are shown. ${withoutFee} other matching course(s) have no published fee and are not counted.`,
        );
      } else
        withoutFee = list.filter((c) => c.tuitionFeeTotal === undefined).length;
      if (a.maxDurationWeeks !== undefined)
        notes.push(
          "Courses with no published duration are left out of the duration filter.",
        );
      if (list.length === 0)
        return notFound(
          "not_in_dataset",
          "No international courses in the Ask Righto index match those filters. Try fewer filters.",
          {
            filters: {
              query: a.query,
              level: a.level,
              field: a.field,
              state: a.state,
              campus: a.campus,
              provider: a.provider,
            },
          },
        );
      list = [...list].sort(
        (x, y) =>
          x.name.localeCompare(y.name) ||
          x.cricosCode.localeCompare(y.cricosCode),
      );
      const limit = a.limit ?? 20;
      const start = a.cursor ? Math.max(0, parseInt(a.cursor, 10) || 0) : 0;
      const page = list.slice(start, start + limit);
      const next =
        start + limit < list.length ? String(start + limit) : undefined;
      return okResult(d, {
        total: list.length,
        returned: page.length,
        ...(next ? { nextCursor: next } : {}),
        matchesWithoutPublishedFee: withoutFee,
        notes,
        courses: page.map((c) => viewOf(d, c)),
        outcome: "results",
      }) as unknown as Found<SearchData>;
    }),
  render: (d) =>
    withNotice(
      [
        `${d.returned} of ${d.total} courses, in order of course name. ${d.matchesWithoutPublishedFee} of the matching courses have no published fee.`,
        ...d.notes,
        ...d.courses.map(
          (c) =>
            `- ${c.name}, ${c.provider} (${c.level}). CRICOS ${c.cricosCode}. ${c.durationWeeks ? `${c.durationWeeks} weeks. ` : "Duration not published. "}${c.tuitionFeeTotal !== undefined ? `Total tuition fee ${aud(c.tuitionFeeTotal)} (${c.feeNote}). ` : "Tuition fee not published. "}${c.locations.length ? `Locations: ${c.locations.join(", ")}.` : "Locations not published."}`,
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
          title: "Courses for international students",
          caption: INTL_NOTICE,
          columns: [
            { key: "course", label: "Course" },
            { key: "provider", label: "Provider" },
            { key: "level", label: "Level" },
            { key: "weeks", label: "Weeks" },
            { key: "fee", label: "Total tuition fee (indicative)" },
            { key: "where", label: "Locations" },
          ],
          rows: r.data.courses.map((c) => ({
            course: c.name,
            provider: c.provider,
            level: c.level,
            weeks: c.durationWeeks ? String(c.durationWeeks) : "Not published",
            fee:
              c.tuitionFeeTotal !== undefined
                ? aud(c.tuitionFeeTotal)
                : "Not published",
            where: c.locations.join(", ") || "Not published",
          })),
          source: inkviewSource(r),
        },
        { limit: 50 },
      );
    }),
});

// ---------------------------------------------------------------- get_intl_course
const courseMarkdown = (v: IntlView) =>
  [
    `${v.name}, ${v.provider}. CRICOS course code ${v.cricosCode}.${v.expired ? " This course is marked as expired in CRICOS." : ""}`,
    `Level: ${v.level}.${v.field ? ` Field of education: ${v.field}.` : ""}`,
    v.durationWeeks
      ? `Duration: ${v.durationWeeks} weeks.`
      : "Duration: not published.",
    v.tuitionFeeTotal !== undefined
      ? `Total tuition fee: ${aud(v.tuitionFeeTotal)} (${v.feeNote}).`
      : "Total tuition fee: not published in CRICOS.",
    v.yearlyFee !== undefined
      ? `Yearly fee ${aud(v.yearlyFee)} (${v.yearlyFeeNote}).`
      : "",
    v.nonTuitionFee !== undefined
      ? `Non-tuition fees: ${aud(v.nonTuitionFee)} (${FEE_LABEL}).`
      : "",
    v.language ? `Language of instruction: ${v.language}.` : "",
    v.workComponent !== undefined
      ? `Work component: ${v.workComponent ? "yes" : "no"}.`
      : "",
    v.locations.length
      ? `Locations: ${v.locations.join(", ")}.`
      : "Locations: not published.",
    v.providerWebsite ? `Provider website: ${v.providerWebsite}.` : "",
    v.domesticCourseId
      ? `Also in the domestic index as ${v.domesticCourseId}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

export const getIntlCourse = defineTool({
  name: "get_intl_course",
  title: "Show one course for international students",
  description:
    "Shows one CRICOS-registered course: provider, level, duration, indicative tuition fee, non-tuition fees, language, work component, locations and the provider's website, each as published, with 'not published' where CRICOS has nothing. Use a CRICOS course code from search_intl_courses. English requirements and entry requirements are not held; use get_intl_entry_checklist.",
  inputSchema: z.object({
    cricosCode: z
      .string()
      .max(20)
      .describe("CRICOS course code from search_intl_courses"),
  }),
  ...base,
  meta: tableMeta("entity_card"),
  handler: (a) =>
    withIntl<IntlView & { notice: string; outcome: string }>((d) => {
      const c = findByCode(d, a.cricosCode);
      if (!c) return notInDataset(a.cricosCode);
      const v = viewOf(d, c);
      return okResult(
        d,
        {
          ...v,
          outcome:
            v.tuitionFeeTotal !== undefined && v.durationWeeks
              ? "complete"
              : "partial",
        },
        expiredWarning(v),
      ) as unknown as Found<IntlView & { notice: string; outcome: string }>;
    }),
  render: (v) => withNotice(courseMarkdown(v)),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<IntlView>;
      const v = r.data;
      return inkview.entityCard({
        name: v.name,
        kind: "organization",
        tagline: `${v.provider}, ${v.level}`,
        description: `CRICOS ${v.cricosCode}${v.expired ? " (expired)" : ""}`,
        facts: [
          {
            label: "Duration",
            value: v.durationWeeks
              ? `${v.durationWeeks} weeks`
              : "Not published",
          },
          {
            label: "Tuition fee (indicative)",
            value:
              v.tuitionFeeTotal !== undefined
                ? aud(v.tuitionFeeTotal)
                : "Not published",
          },
          ...(v.yearlyFee !== undefined
            ? [{ label: "Yearly (calculated)", value: aud(v.yearlyFee) }]
            : []),
          ...(v.nonTuitionFee !== undefined
            ? [{ label: "Non-tuition fees", value: aud(v.nonTuitionFee) }]
            : []),
          ...(v.language
            ? [{ label: "Language", value: v.language.slice(0, 200) }]
            : []),
          {
            label: "Locations",
            value: (v.locations.join(", ") || "Not published").slice(0, 200),
          },
        ],
        links: v.providerWebsite
          ? [{ label: "Provider website", url: v.providerWebsite }]
          : [],
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- compare_intl_courses
interface CompareData {
  courses: IntlView[];
  notice: string;
}
const CMP = [
  "Provider",
  "Level",
  "Duration",
  "Total tuition fee (indicative)",
  "Yearly fee (calculated)",
  "Non-tuition fees",
  "Locations",
];
const cell = (v: IntlView, i: number): string =>
  [
    v.provider,
    v.level,
    v.durationWeeks ? `${v.durationWeeks} weeks` : "Not published",
    v.tuitionFeeTotal !== undefined ? aud(v.tuitionFeeTotal) : "Not published",
    v.yearlyFee !== undefined
      ? aud(v.yearlyFee)
      : "Not shown: needs a published fee and duration",
    v.nonTuitionFee !== undefined ? aud(v.nonTuitionFee) : "Not published",
    v.locations.join(", ") || "Not published",
  ][i]!;

export const compareIntlCourses = defineTool({
  name: "compare_intl_courses",
  title: "Compare courses for international students",
  description:
    "Shows two to five CRICOS-registered courses side by side on the same published fields: provider, level, duration, indicative tuition fee, a calculated yearly fee (only when fee and duration are both published) and locations. It does not pick a winner.",
  inputSchema: z.object({
    cricosCodes: z
      .array(z.string().max(20))
      .min(1)
      .max(12)
      .describe("Two to five CRICOS course codes from search_intl_courses"),
  }),
  ...base,
  meta: tableMeta("comparison"),
  handler: (a) =>
    withIntl<CompareData>((d) => {
      if (a.cricosCodes.length < 2 || a.cricosCodes.length > 5)
        return notFound(
          "needs_input",
          "Compare two to five courses; at most five can be compared at once.",
        );
      const views: IntlView[] = [];
      for (const code of a.cricosCodes) {
        const c = findByCode(d, code);
        if (!c) return notInDataset(code);
        views.push(viewOf(d, c));
      }
      return okResult(
        d,
        { courses: views },
        views.flatMap(expiredWarning),
      ) as unknown as Found<CompareData>;
    }),
  render: (d) =>
    withNotice(
      [
        `| | ${d.courses.map((c) => `${c.name} (${c.cricosCode})`).join(" | ")} |`,
        `|---|${d.courses.map(() => "---").join("|")}|`,
        ...CMP.map(
          (label, i) =>
            `| ${label} | ${d.courses.map((c) => cell(c, i).replace(/\|/g, "/")).join(" | ")} |`,
        ),
        `Yearly fee is ${YEARLY_LABEL}.`,
      ].join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<CompareData>;
      return inkview.comparison({
        title: "Course comparison (no winner is picked)",
        items: r.data.courses.map((c) => ({
          name: c.name.slice(0, 80),
          subtitle: c.provider.slice(0, 120),
          ...(c.providerWebsite ? { url: c.providerWebsite } : {}),
        })),
        criteria: CMP,
        values: r.data.courses.map((c) =>
          CMP.map((_, i) => cell(c, i).slice(0, 200)),
        ),
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- get_intl_entry_checklist
interface ChecklistData {
  cricosCode: string;
  name: string;
  provider: string;
  providerWebsite?: string;
  message: string;
  readingChecklist: readonly string[];
  browsingRules: string;
  noAdvice: string;
  outcome: string;
  notice: string;
}

export const checkIntlEntryChecklist = defineTool({
  name: "get_intl_entry_checklist",
  title: "What to read on the provider's page",
  description:
    "For one CRICOS course, returns the provider's website and a reading checklist (English language requirement, entry requirements by country, intake dates, provider-listed fee and scholarships). Ask Righto holds none of those facts and does not fetch pages: the user's own browsing assistant can read the provider's page on the user's behalf and quote it with the link and time. Gives no visa or migration advice.",
  inputSchema: z.object({
    cricosCode: z
      .string()
      .max(20)
      .describe("CRICOS course code from search_intl_courses"),
  }),
  ...base,
  handler: (a) =>
    withIntl<ChecklistData>((d) => {
      const c = findByCode(d, a.cricosCode);
      if (!c) return notInDataset(a.cricosCode);
      const v = viewOf(d, c);
      return okResult(d, {
        cricosCode: v.cricosCode,
        name: v.name,
        provider: v.provider,
        ...(v.providerWebsite ? { providerWebsite: v.providerWebsite } : {}),
        message: v.providerWebsite
          ? "Ask Righto holds no English, entry-requirement, intake or scholarship facts for this course. Read them on the provider's website."
          : "Ask Righto holds no English, entry-requirement, intake or scholarship facts for this course, and CRICOS lists no website for the provider. Search for the provider's own international student page.",
        readingChecklist: INTL_READING_CHECKLIST,
        browsingRules: INTL_BROWSING_RULES,
        noAdvice: INTL_NO_ADVICE,
        outcome: "checklist",
      }) as unknown as Found<ChecklistData>;
    }),
  render: (d) =>
    withNotice(
      [
        `${d.name}, ${d.provider} (CRICOS ${d.cricosCode}).`,
        d.message,
        d.providerWebsite ? `Provider website: ${d.providerWebsite}` : "",
        "Reading checklist:",
        ...d.readingChecklist.map((x) => `- ${x}`),
        d.browsingRules,
        d.noAdvice,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
});
