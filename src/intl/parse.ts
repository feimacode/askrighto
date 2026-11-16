/**
 * CRICOS course rows for the international finder. Takes CSV text of one course sheet with one row per
 * course. Column names are matched loosely because the real file's layout is not yet confirmed in this repo
 * (docs/cricos-columns.md). A field whose column is absent stays unset; nothing is inferred.
 */
import { parseCsv } from "../courses/cricos.js";
import type {
  IntlCourse,
  IntlLocation,
  IntlProvider,
  LevelGroup,
} from "./types.js";

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "");

const HEADERS = {
  cricosCode: ["cricoscoursecode", "coursecode", "cricoscode"],
  providerCode: ["cricosprovidercode", "providercode", "institutioncode"],
  providerName: ["institutionname", "providername", "institution"],
  providerWebsite: [
    "institutionwebsite",
    "providerwebsite",
    "website",
    "webaddress",
  ],
  courseName: ["coursename", "name"],
  level: ["courselevel", "level"],
  field: ["fieldofeducation", "broadfieldofeducation", "field"],
  durationWeeks: ["durationweeks", "duration", "totalcoursedurationweeks"],
  tuitionFee: [
    "tuitionfee",
    "totaltuitionfee",
    "tuitionfees",
    "totalcoursecost",
    "tuitionfeetotal",
  ],
  nonTuitionFee: ["nontuitionfee", "nontuitionfees", "totalnontuitionfee"],
  language: ["languageofinstruction", "courselanguage", "language"],
  workComponent: [
    "workcomponent",
    "workintegratedlearning",
    "workcomponentincluded",
  ],
  expired: ["expired", "courseexpired", "expirydate", "expiry"],
  locations: ["locations", "courselocations", "location"],
} as const;
type Field = keyof typeof HEADERS;

/** Maps a published level to a group in scope, or undefined for school, ELICOS, VET and non-award levels. */
export function levelGroupOf(level: string): LevelGroup | undefined {
  const l = level.toLowerCase();
  if (/graduate certificate/.test(l)) return "graduate_certificate";
  if (/graduate diploma/.test(l)) return "graduate_diploma";
  if (/master/.test(l)) return "master";
  if (/doctor/.test(l)) return "doctorate";
  if (/associate degree/.test(l)) return "associate_degree";
  if (/bachelor/.test(l)) return "bachelor";
  return undefined;
}

const num = (s: string): number | undefined => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};
const yes = (s: string): boolean | undefined =>
  /^(y|yes|true|1)$/i.test(s.trim())
    ? true
    : /^(n|no|false|0)$/i.test(s.trim())
      ? false
      : undefined;

/** "Campus (VIC)", "VIC: Campus" or "VIC - Campus"; a trailing ", VIC" also works. */
export function parseLocation(raw: string): IntlLocation | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const states = "ACT|NSW|NT|QLD|SA|TAS|VIC|WA";
  let m = new RegExp(`^(.*?)\\s*\\((${states})\\)$`, "i").exec(t);
  if (m) return { campus: m[1]!.trim(), state: m[2]!.toUpperCase() };
  m = new RegExp(`^(${states})\\s*[:\\-]\\s*(.+)$`, "i").exec(t);
  if (m) return { state: m[1]!.toUpperCase(), campus: m[2]!.trim() };
  m = new RegExp(`^(.*?),\\s*(${states})$`, "i").exec(t);
  if (m) return { campus: m[1]!.trim(), state: m[2]!.toUpperCase() };
  return { campus: t, state: "" };
}

export interface IntlParseReport {
  rowsRead: number;
  kept: number;
  excludedByLevel: Record<string, number>;
  duplicateCodes: string[];
  withoutFee: number;
  withoutDuration: number;
  withoutLocation: number;
  columnsFound: string[];
  columnsMissing: string[];
}

export function parseIntlCricos(csv: string): {
  providers: IntlProvider[];
  courses: IntlCourse[];
  report: IntlParseReport;
  problems: string[];
} {
  const rows = parseCsv(csv);
  const empty = {
    providers: [],
    courses: [],
    report: {
      rowsRead: 0,
      kept: 0,
      excludedByLevel: {},
      duplicateCodes: [],
      withoutFee: 0,
      withoutDuration: 0,
      withoutLocation: 0,
      columnsFound: [],
      columnsMissing: [],
    } satisfies IntlParseReport,
  };
  if (rows.length < 2) return { ...empty, problems: ["no rows"] };
  const header = rows[0]!.map(key);
  const col = (f: Field) =>
    header.findIndex((h) => (HEADERS[f] as readonly string[]).includes(h));
  const fields = Object.keys(HEADERS) as Field[];
  const columnsFound = fields.filter((f) => col(f) >= 0);
  const columnsMissing = fields.filter((f) => col(f) < 0);
  const problems = (
    ["cricosCode", "providerCode", "courseName", "level"] as const
  )
    .filter((f) => col(f) < 0)
    .map((f) => `missing column for ${f}`);
  if (problems.length)
    return {
      ...empty,
      report: { ...empty.report, columnsFound, columnsMissing },
      problems,
    };
  const g = (r: string[], f: Field) => {
    const i = col(f);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const providers = new Map<string, IntlProvider>();
  const courses = new Map<string, IntlCourse>();
  const excludedByLevel: Record<string, number> = {};
  const duplicateCodes: string[] = [];
  let rowsRead = 0;
  for (const r of rows.slice(1)) {
    const code = g(r, "cricosCode");
    if (!code) continue;
    rowsRead++;
    const level = g(r, "level");
    const group = levelGroupOf(level);
    if (!group) {
      excludedByLevel[level || "(no level)"] =
        (excludedByLevel[level || "(no level)"] ?? 0) + 1;
      continue;
    }
    if (courses.has(code)) {
      duplicateCodes.push(code);
      continue;
    }
    const providerId = g(r, "providerCode");
    if (!providerId) continue;
    if (!providers.has(providerId))
      providers.set(providerId, {
        id: providerId,
        name: g(r, "providerName") || providerId,
        ...(g(r, "providerWebsite")
          ? { website: g(r, "providerWebsite") }
          : {}),
      });
    const weeks = num(g(r, "durationWeeks"));
    const tuition = num(g(r, "tuitionFee"));
    const nonTuition = num(g(r, "nonTuitionFee"));
    const exp = g(r, "expired");
    const expiredByDate =
      /^\d{4}-\d{2}-\d{2}/.test(exp) &&
      exp.slice(0, 10) < new Date().toISOString().slice(0, 10);
    const work = yes(g(r, "workComponent"));
    const locations = g(r, "locations")
      .split(/[;|]/)
      .map(parseLocation)
      .filter((x): x is IntlLocation => !!x);
    courses.set(code, {
      cricosCode: code,
      providerId,
      name: g(r, "courseName"),
      level,
      levelGroup: group,
      ...(g(r, "field") ? { field: g(r, "field") } : {}),
      ...(weeks ? { durationWeeks: Math.round(weeks) } : {}),
      ...(tuition ? { tuitionFeeTotal: tuition } : {}),
      ...(nonTuition ? { nonTuitionFee: nonTuition } : {}),
      ...(g(r, "language") ? { language: g(r, "language") } : {}),
      ...(work !== undefined ? { workComponent: work } : {}),
      expired: yes(exp) === true || expiredByDate,
      locations,
    });
  }
  const list = [...courses.values()];
  return {
    providers: [...providers.values()],
    courses: list,
    report: {
      rowsRead,
      kept: list.length,
      excludedByLevel,
      duplicateCodes,
      withoutFee: list.filter((c) => c.tuitionFeeTotal === undefined).length,
      withoutDuration: list.filter((c) => c.durationWeeks === undefined).length,
      withoutLocation: list.filter((c) => c.locations.length === 0).length,
      columnsFound,
      columnsMissing,
    },
    problems: [],
  };
}
