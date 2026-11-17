import { z } from "zod";
import {
  inkview,
  inkviewResult,
  inkviewSource,
  tableMeta,
} from "./energy-common.js";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found } from "../core/grounded.js";
import { attributionFor } from "../core/rights.js";
import { getCourses, withVce } from "../courses/index.js";
import { matchStudy } from "../courses/studies.js";
import { AGGREGATE_NOTICE } from "../courses/notice.js";
import { computeAggregate, type Counted } from "../vce/aggregate.js";
import type {
  EarlyEntryScheme,
  KeyDate,
  PreferenceRule,
} from "../vce/types.js";
import {
  nextIntakeYear,
  resolveStudies,
  studyNamesSchemaNote,
} from "./course-common.js";

const ro = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const SCALING_LICENCE =
  "Reused with VTAC's written permission (conditions apply)";

// ---------------------------------------------------------------- get_subject_scaling
interface ScalingData {
  study: string;
  studyYear: number;
  points: Array<{ rawStudyScore: number; scaledScore: number }>;
  note: string;
  notice: string;
}
export const getSubjectScaling = defineTool({
  name: "get_subject_scaling",
  title: "Get VCE study scaling",
  description:
    "Shows how one VCE study's raw study scores scale, from the published scaling table of a past study year. Scaling changes every year and an aggregate is not an ATAR. This data may be unavailable until VTAC's permission is recorded.",
  inputSchema: z.object({
    study: z.string().max(80).describe(`A VCE study (${studyNamesSchemaNote})`),
    studyYear: z
      .number()
      .int()
      .min(2015)
      .max(2035)
      .optional()
      .describe("Study year of the scaling table; defaults to the latest held"),
  }),
  ...ro,
  datasets: ["vce-scaling"],
  meta: tableMeta("data_table"),
  handler: (a) =>
    withVce<ScalingData>((d) => {
      const m = matchStudy(a.study);
      if (!m.ok)
        return notFound(
          "needs_input",
          `"${a.study}" is not a single VCE study Ask Righto knows.${m.candidates.length ? ` Did the student mean: ${m.candidates.map((s) => s.name).join("; ")}?` : ""}`,
          { candidates: m.candidates.map((s) => s.name) },
        );
      const table = a.studyYear
        ? d.scaling.find((t) => t.studyYear === a.studyYear)
        : [...d.scaling].sort((x, y) => y.studyYear - x.studyYear)[0];
      if (!table)
        return notFound(
          "data_unavailable",
          "No scaling table is held for that study year.",
          { yearsHeld: d.scaling.map((t) => t.studyYear) },
        );
      const s = table.studies.find((x) => x.studyId === m.study.id);
      if (!s)
        return notFound(
          "not_in_dataset",
          `${m.study.name} has no scaling in the ${table.studyYear} table.`,
        );
      const raws = [...s.points].sort((x, y) => x[0] - y[0]);
      const attribution = attributionFor(["vce-scaling"]);
      return found({
        data: {
          study: m.study.name,
          studyYear: table.studyYear,
          points: raws.map(([r, v]) => ({ rawStudyScore: r, scaledScore: v })),
          note: `These are scaled scores at published raw scores from the ${table.studyYear} study year. Scores between points are not published; estimate_vce_aggregate marks interpolated values.`,
          notice: AGGREGATE_NOTICE,
        },
        source: {
          name: `VTAC scaling report, study year ${table.studyYear}`,
          url: table.sourceUrl,
          licence: SCALING_LICENCE,
          ...(attribution ? { attribution } : {}),
        },
        asOf: d.loadedAt,
      });
    }),
  render: (d) =>
    `${d.study}, ${d.studyYear} scaling: ${d.points.map((p) => `raw ${p.rawStudyScore} scales to ${p.scaledScore}`).join("; ")}.\n${d.note}\n\n${d.notice}`,
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<ScalingData>;
      return inkview.table({
        title: `${r.data.study}: scaling, study year ${r.data.studyYear}`,
        caption: r.data.notice,
        columns: [
          { key: "raw", label: "Raw study score", type: "number" },
          { key: "scaled", label: "Scaled score", type: "number" },
        ],
        rows: r.data.points.map((p) => ({
          raw: p.rawStudyScore,
          scaled: p.scaledScore,
        })),
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- estimate_vce_aggregate
interface AggData {
  studyYear: number;
  computed: boolean;
  aggregate?: number;
  reason?: string;
  studies: Array<Omit<Counted, "studyId"> & { study: string }>;
  notAnAtar: string;
  notice: string;
}
export const estimateVceAggregate = defineTool({
  name: "estimate_vce_aggregate",
  title: "Estimate a VCE aggregate",
  description:
    "Calculates a VCE aggregate from four to six studies and the student's expected study scores, using a past year's published scaling, and shows each study's scaled score and whether it counts in the primary four, as a 10% increment, or not at all. An aggregate is not an ATAR and this tool never gives an ATAR. Scores are used for this call only. Do not ask for the student's name or school. This data may be unavailable until VTAC's permission is recorded.",
  inputSchema: z.object({
    vceStudies: z
      .array(z.string().max(80))
      .min(1)
      .max(12)
      .describe(`Four to six VCE studies (${studyNamesSchemaNote})`),
    studyScores: z
      .array(z.number().min(0).max(50))
      .min(1)
      .max(12)
      .describe("Expected raw study score for each study, in the same order"),
    studyYear: z
      .number()
      .int()
      .min(2015)
      .max(2035)
      .optional()
      .describe("Study year of the scaling table; defaults to the latest held"),
  }),
  ...ro,
  datasets: ["vce-scaling", "vce-study-groupings"],
  meta: tableMeta("data_table"),
  handler: (a) =>
    withVce<AggData>((d) => {
      if (a.vceStudies.length < 4 || a.vceStudies.length > 6)
        return notFound(
          "needs_input",
          "Give four to six studies, each with an expected study score in the same order.",
        );
      const r = resolveStudies(a.vceStudies, a.studyScores);
      if (!r.ok) return r.result;
      if (r.value.studies.length !== a.vceStudies.length)
        return notFound(
          "needs_input",
          "The same study appears twice. Give each study once.",
        );
      const table = a.studyYear
        ? d.scaling.find((t) => t.studyYear === a.studyYear)
        : [...d.scaling].sort((x, y) => y.studyYear - x.studyYear)[0];
      const groups = table
        ? d.groupings.find((g) => g.studyYear === table.studyYear)
        : undefined;
      if (!table || !groups)
        return notFound(
          "data_unavailable",
          "The scaling table and study area groupings for that study year are not held, so an aggregate cannot be calculated.",
          { yearsHeld: d.scaling.map((t) => t.studyYear) },
        );
      const res = computeAggregate(
        r.value.echo.map((e) => ({
          studyId: e.studyId,
          name: e.study,
          raw: e.score!,
        })),
        table,
        groups,
      );
      const attribution = attributionFor([
        "vce-scaling",
        "vce-study-groupings",
      ]);
      return found({
        data: {
          studyYear: table.studyYear,
          computed: res.computed,
          ...(res.computed
            ? { aggregate: res.aggregate }
            : { reason: res.reason }),
          studies: res.studies.map((x) => ({
            study: x.name,
            name: x.name,
            raw: x.raw,
            scaled: x.scaled,
            interpolated: x.interpolated,
            role: x.role,
            contribution: x.contribution,
            reason: x.reason,
          })),
          notAnAtar:
            "This is an aggregate, not an ATAR. The ATAR ranks aggregates against the whole state cohort and is not calculated here.",
          notice: AGGREGATE_NOTICE,
        },
        source: {
          name: `VTAC scaling report and study area groupings, study year ${table.studyYear}`,
          url: table.sourceUrl,
          licence: SCALING_LICENCE,
          ...(attribution ? { attribution } : {}),
        },
        asOf: d.loadedAt,
      });
    }),
  render: (d) =>
    [
      d.computed
        ? `Aggregate: ${d.aggregate} (using the ${d.studyYear} scaling).`
        : `Not calculated: ${d.reason}`,
      ...d.studies.map(
        (s) =>
          `- ${s.study}: raw ${s.raw}, scaled ${s.scaled}${s.interpolated ? " (interpolated between published points)" : ""}, ${s.role.replace("_", " ")}${s.role === "increment" ? ` (counts ${s.contribution})` : ""}. ${s.reason}`,
      ),
      d.notAnAtar,
      d.notice,
    ].join("\n"),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<AggData>;
      return inkview.table({
        title: `Aggregate from ${r.data.studies.length} studies`,
        caption: r.data.notAnAtar,
        columns: [
          { key: "study", label: "Study" },
          { key: "raw", label: "Raw", type: "number" },
          { key: "scaled", label: "Scaled", type: "number" },
          { key: "role", label: "Counts as", type: "badge" },
          { key: "why", label: "Why" },
        ],
        rows: r.data.studies.map((s) => ({
          study: s.study,
          raw: s.raw,
          scaled: s.scaled,
          role: s.role.replace("_", " "),
          why: s.reason,
        })),
        source: inkviewSource(r),
      });
    }),
});

// ---------------------------------------------------------------- get_vce_key_dates
interface DatesData {
  admissionsYear: number;
  dates: Array<KeyDate>;
  preferenceRules: PreferenceRule[];
  note: string;
  notice: string;
}
const DATES_NOTICE =
  "Dates are as published and can change; provisional dates are marked. Check the VCAA and VTAC pages. General information, not advice.";
export const getVceKeyDates = defineTool({
  name: "get_vce_key_dates",
  title: "Get VCE and VTAC key dates",
  description:
    "Lists VCAA exam and results dates and VTAC application, SEAS and offer-round dates for an admissions year, each with its source link and whether it is provisional, plus a short summary of how VTAC preferences and offers work.",
  inputSchema: z.object({
    admissionsYear: z
      .number()
      .int()
      .min(2025)
      .max(2035)
      .optional()
      .describe(
        "The year of university entry, e.g. 2027 for students finishing Year 12 in 2026. Defaults to next year",
      ),
    kind: z
      .enum(["vcaa", "vtac", "all"])
      .optional()
      .describe("Only VCAA or only VTAC dates; default all"),
  }),
  ...ro,
  datasets: ["vce-key-dates", "vtac-preference-rules"],
  meta: tableMeta("data_table"),
  handler: (a) =>
    withVce<DatesData>((d) => {
      const year = a.admissionsYear ?? nextIntakeYear();
      const y = d.keyDates.find((k) => k.year === year);
      if (!y)
        return notFound(
          "not_in_dataset",
          `No dates are held for ${year} entry. Held: ${d.keyDates.map((k) => k.year).join(", ") || "none"}. The VCAA and VTAC sites have the current dates.`,
          {
            yearsHeld: d.keyDates.map((k) => k.year),
            links: [
              "https://www.vtac.edu.au/dates",
              "https://www.vcaa.vic.edu.au/administration/key-dates",
            ],
          },
        );
      const kind = a.kind ?? "all";
      const dates = y.dates.filter(
        (x) => kind === "all" || x.issuingBody.toLowerCase() === kind,
      );
      const checked = [
        ...dates.map((x) => x.checkedOn),
        ...d.preferenceRules.map((r) => r.checkedOn),
      ].sort()[0];
      return found({
        data: {
          admissionsYear: year,
          dates,
          preferenceRules: kind === "vcaa" ? [] : d.preferenceRules,
          note: dates.some((x) => x.provisional)
            ? "Some dates are provisional and still to be re-read from the official pages."
            : "",
          notice: DATES_NOTICE,
        },
        source: {
          name: "VCAA and VTAC key dates (our summary)",
          url: "https://www.vtac.edu.au/dates",
          licence: "Facts in our own words; see the official pages",
        },
        asOf: checked ? `${checked}T00:00:00Z` : d.loadedAt,
      });
    }),
  render: (d) =>
    [
      `Key dates for ${d.admissionsYear} entry:`,
      ...d.dates.map(
        (x) =>
          `- ${x.date}${x.endDate ? ` to ${x.endDate}` : ""}: ${x.title} (${x.issuingBody}${x.provisional ? ", provisional" : ""}). ${x.sourceUrl}, checked ${x.checkedOn}`,
      ),
      ...(d.preferenceRules.length
        ? [
            "How preferences and offers work:",
            ...d.preferenceRules.map((r) => `- ${r.title}: ${r.text}`),
          ]
        : []),
      d.note,
      d.notice,
    ]
      .filter(Boolean)
      .join("\n"),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<DatesData>;
      return inkview.table(
        {
          title: `Key dates, ${r.data.admissionsYear} entry`,
          caption: DATES_NOTICE,
          columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "title", label: "What" },
            { key: "body", label: "Body", type: "badge" },
            { key: "prov", label: "Status" },
            { key: "link", label: "Source", type: "link" },
          ],
          rows: r.data.dates.map((x) => ({
            date: x.date,
            title: x.title,
            body: x.issuingBody,
            prov: x.provisional ? "Provisional" : "Confirmed",
            link: x.sourceUrl,
          })),
          source: inkviewSource(r),
        },
        { limit: 50 },
      );
    }),
});

// ---------------------------------------------------------------- list_early_entry_schemes
interface SchemesData {
  admissionsYear: number;
  schemes: EarlyEntryScheme[];
  note: string;
  notice: string;
}
const SCHEME_NOTICE =
  "These describe each university's scheme. Whether a student qualifies is the university's decision: read the scheme page. Coverage is partial. General information, not advice.";
export const listEarlyEntrySchemes = defineTool({
  name: "list_early_entry_schemes",
  title: "List university early entry schemes",
  description:
    "Lists Victorian university early offer and guarantee schemes with a short description, application window if known, and the scheme page. It never says whether a student is eligible.",
  inputSchema: z.object({
    university: z
      .string()
      .max(80)
      .optional()
      .describe("University name or short name"),
    courseId: z
      .string()
      .max(120)
      .optional()
      .describe("A course id; lists the schemes of that course's university"),
    admissionsYear: z.number().int().min(2025).max(2035).optional(),
  }),
  ...ro,
  datasets: ["vic-early-entry"],
  meta: tableMeta("data_table"),
  handler: async (a) => {
    let uni = a.university;
    if (a.courseId) {
      const cat = await getCourses()
        ?.courses.catalogue()
        .catch(() => undefined);
      const c = cat?.courses.find((x) => x.id === a.courseId);
      if (!cat || !c)
        return notFound(
          "not_in_dataset",
          `No course with id "${a.courseId}" is in the index. Use search_domestic_courses, or name the university.`,
        );
      uni = cat.providers.find((p) => p.id === c.providerId)?.name;
    }
    return withVce<SchemesData>(async (d) => {
      const year = a.admissionsYear ?? nextIntakeYear();
      let list = d.earlyEntry.filter((s) => s.admissionsYear === year);
      if (uni) {
        const n = uni.toLowerCase().replace(/[^a-z0-9 ]/g, "");
        list = list.filter(
          (s) =>
            s.university.toLowerCase().includes(n) ||
            n.split(" ").every((w) => s.university.toLowerCase().includes(w)),
        );
      }
      if (list.length === 0)
        return notFound(
          "not_in_dataset",
          `No early entry scheme is held${uni ? ` for ${uni}` : ""} for ${year} entry. Coverage is partial, so check the university's own admissions pages.`,
        );
      const checked = list.map((s) => s.checkedOn).sort()[0]!;
      return found({
        data: {
          admissionsYear: year,
          schemes: list,
          note: "Coverage is partial: Deakin, Monash and Melbourne run other kinds of scheme that are not listed here.",
          notice: SCHEME_NOTICE,
        },
        source: {
          name: "Victorian university early entry pages (our summary)",
          url: list[0]!.sourceUrl,
          licence: "Facts in our own words; see the official pages",
        },
        asOf: `${checked}T00:00:00Z`,
      });
    });
  },
  render: (d) =>
    [
      `Early entry schemes for ${d.admissionsYear} entry:`,
      ...d.schemes.map(
        (s) =>
          `- ${s.university}, ${s.name}: ${s.summary}${s.applicationWindow ? ` Window: ${s.applicationWindow}` : ""}${s.provisional ? " (to be re-read)" : ""} ${s.sourceUrl}`,
      ),
      d.note,
      d.notice,
    ].join("\n"),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<SchemesData>;
      return inkview.table({
        title: `Early entry schemes, ${r.data.admissionsYear} entry`,
        caption: SCHEME_NOTICE,
        columns: [
          { key: "uni", label: "University" },
          { key: "name", label: "Scheme" },
          { key: "what", label: "What it covers" },
          { key: "window", label: "Window" },
          { key: "link", label: "Scheme page", type: "link" },
        ],
        rows: r.data.schemes.map((s) => ({
          uni: s.university,
          name: s.name,
          what: s.summary,
          window: s.applicationWindow ?? "See the scheme page",
          link: s.sourceUrl,
        })),
        source: inkviewSource(r),
      });
    }),
});
