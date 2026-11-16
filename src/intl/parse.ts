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
  field: [
    "fieldofeducation",
    "broadfieldofeducation",
    "field",
    "fieldofeducation1broadfield",
  ],
  fieldNarrow: ["fieldofeducation1narrowfield"],
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

/** The real export has two title rows above the header. Returns the rows from the first row that looks like a header. */
export function fromHeader(
  rows: string[][],
  accepted: readonly string[],
  minMatch = 3,
): string[][] {
  const want = new Set(accepted);
  for (let i = 0; i < Math.min(rows.length, 10); i++)
    if (rows[i]!.filter((c) => want.has(key(c))).length >= minMatch)
      return rows.slice(i);
  return rows;
}

/** Adds a scheme to a bare website such as "www.ecu.edu.au". Anything that does not look like a host is dropped. */
export function normaliseWebsite(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const withScheme = /^https?:\/\//i.test(t)
    ? t
    : `https://${t.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes(".") ? withScheme : undefined;
  } catch {
    return undefined;
  }
}

export interface IntlParseOptions {
  /** Course Locations sheet as CSV: one row per course and location. */
  courseLocationsCsv?: string;
  /** Institutions sheet as CSV: provider website. */
  institutionsCsv?: string;
}

export interface IntlParseReport {
  rowsRead: number;
  kept: number;
  excludedByLevel: Record<string, number>;
  duplicateCodes: string[];
  withoutFee: number;
  withoutDuration: number;
  withoutLocation: number;
  /** Which optional sheets were supplied. */
  joined: { courseLocations: boolean; institutions: boolean };
  columnsFound: string[];
  columnsMissing: string[];
}

const LOC_HEADERS = {
  providerCode: HEADERS.providerCode,
  cricosCode: HEADERS.cricosCode,
  name: ["locationname", "campus", "campusname"],
  city: ["locationcity", "city"],
  state: ["locationstate", "state"],
} as const;
const INST_HEADERS = {
  providerCode: HEADERS.providerCode,
  website: HEADERS.providerWebsite,
} as const;

/** Reads a sheet with named columns; rows come back as objects keyed by our field names. */
function readSheet<H extends Record<string, readonly string[]>>(
  csv: string,
  headers: H,
): Array<Record<keyof H, string>> {
  const all = Object.values(headers).flat();
  const rows = fromHeader(parseCsv(csv), all, 2);
  if (rows.length < 2) return [];
  const head = rows[0]!.map(key);
  const idx = Object.fromEntries(
    Object.entries(headers).map(([f, names]) => [
      f,
      head.findIndex((h) => names.includes(h)),
    ]),
  );
  return rows
    .slice(1)
    .map(
      (r) =>
        Object.fromEntries(
          Object.keys(headers).map((f) => [
            f,
            idx[f]! >= 0 ? (r[idx[f]!] ?? "").trim() : "",
          ]),
        ) as Record<keyof H, string>,
    );
}

export function parseIntlCricos(
  csv: string,
  opts: IntlParseOptions = {},
): {
  providers: IntlProvider[];
  courses: IntlCourse[];
  report: IntlParseReport;
  problems: string[];
} {
  const rows = fromHeader(parseCsv(csv), Object.values(HEADERS).flat());
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
      joined: { courseLocations: false, institutions: false },
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
  const columnsMissing = fields.filter(
    (f) =>
      col(f) < 0 &&
      f !== "fieldNarrow" &&
      !(f === "locations" && opts.courseLocationsCsv) &&
      !(f === "providerWebsite" && opts.institutionsCsv),
  );
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
  // Optional sheets: locations come from Course Locations and websites from Institutions in the real export.
  const locByCourse = new Map<string, IntlLocation[]>();
  if (opts.courseLocationsCsv)
    for (const r of readSheet(opts.courseLocationsCsv, LOC_HEADERS)) {
      if (!r.cricosCode || !r.name) continue;
      const campus =
        r.city && !r.name.toLowerCase().includes(r.city.toLowerCase())
          ? `${r.name}, ${r.city}`
          : r.name;
      const k = `${r.providerCode}|${r.cricosCode}`;
      locByCourse.set(k, [
        ...(locByCourse.get(k) ?? []),
        { state: r.state.toUpperCase(), campus },
      ]);
    }
  const websites = new Map<string, string>();
  if (opts.institutionsCsv)
    for (const r of readSheet(opts.institutionsCsv, INST_HEADERS)) {
      const w = normaliseWebsite(r.website);
      if (r.providerCode && w) websites.set(r.providerCode, w);
    }
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
        ...((websites.get(providerId) ??
        normaliseWebsite(g(r, "providerWebsite")))
          ? {
              website: (websites.get(providerId) ??
                normaliseWebsite(g(r, "providerWebsite")))!,
            }
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
    const locations = opts.courseLocationsCsv
      ? (locByCourse.get(`${providerId}|${code}`) ?? [])
      : g(r, "locations")
          .split(/[;|]/)
          .map(parseLocation)
          .filter((x): x is IntlLocation => !!x);
    const field = [g(r, "field"), g(r, "fieldNarrow")]
      .filter(Boolean)
      .join("; ");
    courses.set(code, {
      cricosCode: code,
      providerId,
      name: g(r, "courseName"),
      level,
      levelGroup: group,
      ...(field ? { field } : {}),
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
      joined: {
        courseLocations: !!opts.courseLocationsCsv,
        institutions: !!opts.institutionsCsv,
      },
      columnsFound,
      columnsMissing,
    },
    problems: [],
  };
}
