import { z } from "zod";
import { inkview, inkviewResult, inkviewSource, tableMeta } from "./energy-common.js";
import { defineTool } from "../core/define-tool.js";
import { found, notFound, type Found, type Grounded } from "../core/grounded.js";
import { withCareers } from "../careers/index.js";
import { CAREER_NOT_COVERED, CAREER_NOTICE, CAREER_OFFICIAL_URL, CAREER_SOURCE, CAREER_CAPTION } from "../careers/notice.js";
import { SKILL_LEVEL_QUALIFICATIONS, type CareerData, type Occupation } from "../careers/types.js";

const base = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  datasets: ["career-outcomes"] as const,
} as const;

const withNotice = (t: string) => `${t}\n\n${CAREER_NOTICE}`;
const lower = (s: string) => s.toLowerCase();

const okResult = <T extends object>(d: CareerData, data: T, warnings: string[] = []): Found<T & { notice: string }> =>
  found({
    data: { ...data, notice: CAREER_NOTICE },
    source: { ...CAREER_SOURCE },
    asOf: d.sourceDate,
    warnings,
  });

/** Percentage as the file's fraction times 100, rounded to two places. A change of unit, not a new figure. */
const pct = (f: number | undefined) => (f === undefined ? undefined : Math.round(f * 10000) / 100);
const thousands = (n: number | undefined) => (n === undefined ? "not published" : `${n.toLocaleString("en-AU", { maximumFractionDigits: 2 })} thousand`);
const pctText = (p: number | undefined) => (p === undefined ? "not published" : `${p}%`);

// ---------------------------------------------------------------- find_occupations
interface OccupationRef {
  code: string;
  name: string;
  skillLevel?: string;
}
interface FindData {
  total: number;
  returned: number;
  occupations: OccupationRef[];
  classification: string;
  notice: string;
}

export const findOccupations = defineTool({
  name: "find_occupations",
  title: "Find occupations by name",
  description:
    "Finds occupations (ANZSCO 4-digit unit groups) whose published name contains every word given, for example 'nurse' or 'software engineer'. Returns each occupation's code and name, to use with get_occupation_outlook. Matches names only: no pay, vacancies, visa information, or course links. With several results, ask the person which occupation they mean.",
  inputSchema: z.object({
    query: z.string().min(2).max(80).describe("Part of an occupation name, e.g. electrician"),
    limit: z.number().int().min(1).max(30).optional().describe("Occupations to return, default 10"),
  }),
  ...base,
  meta: tableMeta("data_table"),
  handler: (a) =>
    withCareers<FindData>((d) => {
      const words = lower(a.query).split(/\s+/).filter(Boolean);
      const list = d.occupations
        .filter((o) => o.level === 4 && !o.nfd)
        .filter((o) => words.every((w) => lower(o.name).includes(w)))
        .sort((x, y) => x.name.localeCompare(y.name) || x.code.localeCompare(y.code));
      if (list.length === 0)
        return notFound("not_in_dataset", `No occupation in the Jobs and Skills Australia projections has a name containing "${a.query}". Try a shorter or different word, or see ${CAREER_OFFICIAL_URL}.`, {
          officialUrl: CAREER_OFFICIAL_URL,
        });
      const limit = a.limit ?? 10;
      const page = list.slice(0, limit);
      return okResult(d, {
        total: list.length,
        returned: page.length,
        occupations: page.map((o) => ({ code: o.code, name: o.name, ...(o.skillLevel ? { skillLevel: o.skillLevel } : {}) })),
        classification: d.classification,
        outcome: "results",
      }) as unknown as Found<FindData>;
    }),
  render: (d) =>
    withNotice(
      [
        `${d.returned} of ${d.total} occupations (${d.classification} unit groups), in name order.`,
        ...d.occupations.map((o) => `- ${o.name}, code ${o.code}${o.skillLevel && o.skillLevel !== "-" ? `, skill level ${o.skillLevel}` : ""}.`),
        d.total > d.returned ? "More match: narrow the search or raise the limit." : "",
        CAREER_NOT_COVERED,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<FindData>;
      return inkview.table(
        {
          title: "Occupations",
          caption: CAREER_CAPTION,
          columns: [
            { key: "name", label: "Occupation" },
            { key: "code", label: "Code" },
            { key: "skill", label: "Skill level" },
          ],
          rows: r.data.occupations.map((o) => ({ name: o.name, code: o.code, skill: o.skillLevel ?? "Not published" })),
          source: inkviewSource(r),
        },
        { limit: 30 },
      );
    }),
});

// ---------------------------------------------------------------- get_occupation_outlook
interface Change {
  thousands?: number;
  percent?: number;
}
interface OutlookData {
  code: string;
  name: string;
  groupLevel: boolean;
  skillLevel?: string;
  /** The qualification level the JSA data dictionary pairs with the skill level; a level of study, not a field. */
  skillLevelQualification?: string;
  classification: string;
  employmentThousands: { period: string; thousands?: number }[];
  change5Years?: Change;
  change10Years?: Change;
  unit: string;
  notCovered: string;
  officialUrl: string;
  notice: string;
  outcome: string;
}

function outlookOf(d: CareerData, o: Occupation): Omit<OutlookData, "notice"> {
  const q = o.skillLevel ? SKILL_LEVEL_QUALIFICATIONS[o.skillLevel] : undefined;
  const ch = (k: number | undefined, p: number | undefined): Change | undefined =>
    k === undefined && p === undefined ? undefined : { ...(k !== undefined ? { thousands: k } : {}), ...(p !== undefined ? { percent: pct(p)! } : {}) };
  const c5 = ch(o.change5K, o.change5Pct);
  const c10 = ch(o.change10K, o.change10Pct);
  return {
    code: o.code,
    name: o.name,
    groupLevel: o.level !== 4,
    ...(o.skillLevel ? { skillLevel: o.skillLevel } : {}),
    ...(q ? { skillLevelQualification: q } : {}),
    classification: d.classification,
    employmentThousands: [
      { period: d.baselineLabel, ...(o.baselineK !== undefined ? { thousands: o.baselineK } : {}) },
      { period: d.midLabel, ...(o.midK !== undefined ? { thousands: o.midK } : {}) },
      { period: d.endLabel, ...(o.endK !== undefined ? { thousands: o.endK } : {}) },
    ],
    ...(c5 ? { change5Years: c5 } : {}),
    ...(c10 ? { change10Years: c10 } : {}),
    unit: "Employment is in thousands of people, as published; changes are from the baseline year to the projection year.",
    notCovered: CAREER_NOT_COVERED,
    officialUrl: CAREER_OFFICIAL_URL,
    outcome: o.baselineK === undefined ? "no_projection" : "outlook",
  };
}

const outlookText = (o: OutlookData) =>
  [
    `${o.name} (${o.classification} code ${o.code}${o.groupLevel ? ", a broader occupation group" : ""}).`,
    `Employment: ${o.employmentThousands.map((e) => `${e.period} ${thousands(e.thousands)}`).join("; ")}.`,
    o.change5Years ? `Five-year change: ${thousands(o.change5Years.thousands)} people (${pctText(o.change5Years.percent)}).` : "Five-year change: not published.",
    o.change10Years ? `Ten-year change: ${thousands(o.change10Years.thousands)} people (${pctText(o.change10Years.percent)}).` : "Ten-year change: not published.",
    o.skillLevel && o.skillLevel !== "-"
      ? `Skill level ${o.skillLevel}${o.skillLevelQualification ? `, which Jobs and Skills Australia pairs with: ${o.skillLevelQualification}` : ""}. This is a level of study, not a field of study. A unit group can span several skill levels.`
      : "Skill level: not published at this level.",
    o.unit,
    o.notCovered,
    `Official page: ${o.officialUrl}`,
  ].join("\n");

export const getOccupationOutlook = defineTool({
  name: "get_occupation_outlook",
  title: "Show an occupation's employment outlook",
  description:
    "Shows Jobs and Skills Australia's published employment projection for one occupation: employment at the baseline year and two projection years (in thousands of people), five- and ten-year change, and the skill level with the qualification level JSA pairs with it. Use a code from find_occupations. Projections are indicative. Not covered: pay, vacancies, visa advice, and which course or field leads to the occupation.",
  inputSchema: z.object({
    code: z.string().regex(/^\d{1,4}$/).describe("ANZSCO code from find_occupations, e.g. 2411"),
  }),
  ...base,
  meta: tableMeta("entity_card"),
  handler: (a) =>
    withCareers<OutlookData>((d): Grounded<OutlookData> => {
      const o = d.occupations.find((x) => x.code === a.code && !x.nfd);
      if (!o)
        return notFound("not_in_dataset", `No occupation with code "${a.code}" is in the Ask Righto copy of the Jobs and Skills Australia projections. Use find_occupations to find the code, or see ${CAREER_OFFICIAL_URL}.`, {
          officialUrl: CAREER_OFFICIAL_URL,
        });
      return okResult(d, outlookOf(d, o)) as unknown as Found<OutlookData>;
    }),
  render: (d) => withNotice(outlookText(d)),
  decorate: (result) =>
    inkviewResult(result, () => {
      const r = result as Found<OutlookData>;
      const v = r.data;
      return inkview.entityCard({
        name: v.name,
        kind: "organization",
        tagline: `${v.classification} code ${v.code}`,
        description: CAREER_CAPTION,
        facts: [
          ...v.employmentThousands.map((e) => ({ label: `Employment ${e.period}`, value: `${thousands(e.thousands)} people` })),
          { label: "Five-year change", value: v.change5Years ? `${pctText(v.change5Years.percent)}` : "Not published" },
          { label: "Ten-year change", value: v.change10Years ? `${pctText(v.change10Years.percent)}` : "Not published" },
        ],
        links: [{ label: "Jobs and Skills Australia", url: v.officialUrl }],
        source: inkviewSource(r),
      });
    }),
});

export const CAREER_TOOLS = [findOccupations, getOccupationOutlook] as const;
