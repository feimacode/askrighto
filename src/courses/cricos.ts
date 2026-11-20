/**
 * CRICOS course list parsing (CC BY 2.5 AU, Australian Government Department of Education, via data.gov.au).
 * Takes CSV text; if the download is a spreadsheet, export the course sheet to CSV first. Column names are
 * matched loosely because the file layout has not been confirmed against a real download in this repo yet
 * (see docs/course-data.md).
 */
import { LOC_HEADERS, readSheet } from "../intl/parse.js";

export interface CricosCourse {
  cricosCode: string;
  providerCode: string;
  providerName?: string;
  courseName: string;
  level?: string;
  durationWeeks?: number;
  locations: string[];
}

/** Minimal RFC 4180 CSV reader. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "");
const HEADERS: Record<keyof CricosCourse, string[]> = {
  cricosCode: ["cricoscoursecode", "coursecode", "cricoscode"],
  providerCode: ["cricosprovidercode", "providercode", "institutioncode"],
  providerName: ["institutionname", "providername", "institution"],
  courseName: ["coursename", "name"],
  level: ["courselevel", "level"],
  durationWeeks: ["durationweeks", "duration"],
  locations: ["locations", "courselocations", "location"],
};

export function parseCricos(
  csv: string,
  courseLocationsCsv?: string,
): {
  courses: CricosCourse[];
  problems: string[];
} {
  const all = parseCsv(csv);
  // The real export has title rows above the header; start at the first row that names a course code column.
  const at = all.findIndex(
    (r, i) => i < 10 && r.some((c) => HEADERS.cricosCode.includes(key(c))),
  );
  const rows = at > 0 ? all.slice(at) : all;
  const problems: string[] = [];
  if (rows.length < 2) return { courses: [], problems: ["no rows"] };
  const header = rows[0]!.map(key);
  const col = (f: keyof CricosCourse) =>
    header.findIndex((h) => HEADERS[f].includes(h));
  const idx = {
    cricosCode: col("cricosCode"),
    providerCode: col("providerCode"),
    courseName: col("courseName"),
  };
  for (const [name, i] of Object.entries(idx))
    if (i < 0) problems.push(`missing column for ${name}`);
  if (problems.length) return { courses: [], problems };
  const g = (r: string[], f: keyof CricosCourse) => {
    const i = col(f);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  // The real file keeps locations on its own Course Locations sheet (docs/cricos-columns.md).
  const locByCourse = new Map<string, string[]>();
  if (courseLocationsCsv)
    for (const r of readSheet(courseLocationsCsv, LOC_HEADERS)) {
      if (!r.cricosCode || !r.name) continue;
      const campus =
        r.city && !r.name.toLowerCase().includes(r.city.toLowerCase())
          ? `${r.name}, ${r.city}`
          : r.name;
      const k = `${r.providerCode}|${r.cricosCode}`;
      const list = locByCourse.get(k) ?? [];
      if (!list.includes(campus)) list.push(campus);
      locByCourse.set(k, list);
    }
  const courses: CricosCourse[] = [];
  for (const r of rows.slice(1)) {
    const code = g(r, "cricosCode");
    if (!code) continue;
    const weeks = Number(g(r, "durationWeeks"));
    courses.push({
      cricosCode: code,
      providerCode: g(r, "providerCode"),
      ...(g(r, "providerName") ? { providerName: g(r, "providerName") } : {}),
      courseName: g(r, "courseName"),
      ...(g(r, "level") ? { level: g(r, "level") } : {}),
      ...(Number.isFinite(weeks) && weeks > 0 ? { durationWeeks: weeks } : {}),
      locations: courseLocationsCsv
        ? (locByCourse.get(`${g(r, "providerCode")}|${code}`) ?? [])
        : g(r, "locations")
            .split(/[;|]/)
            .map((x) => x.trim())
            .filter(Boolean),
    });
  }
  return { courses, problems };
}

/** Undergraduate levels the index covers. */
export function isUndergraduate(level: string | undefined): boolean {
  return (
    /bachelor|associate degree/i.test(level ?? "") &&
    !/graduate (certificate|diploma)|master|doctor/i.test(level ?? "")
  );
}
