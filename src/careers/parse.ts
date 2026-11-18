/**
 * Reads the JSA employment projections workbook (xlsx). The occupation unit group sheet has title and note rows
 * above the header and footnotes below the data, so the header row is found by its text, not by position.
 * Problems are collected, not thrown, so `careers:validate` can print them all.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import readExcelFile from "read-excel-file/node";
import type { Occupation } from "./types.js";

export interface CareerParseReport {
  rowsRead: number;
  unitGroups: number;
  nfdRows: number;
  rowsWithoutEmployment: number;
  duplicateKeys: string[];
  problems: string[];
}

export interface CareerParseResult {
  occupations: Occupation[];
  baselineLabel: string;
  midLabel: string;
  endLabel: string;
  classification: string;
  fileHash: string;
  report: CareerParseReport;
}

type Cell = string | number | boolean | Date | null | undefined;
const text = (v: Cell) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: Cell): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
};

/** Finds a column by words that all appear in its (lower-case) combined header text. */
function findCol(headers: string[], all: string[], none: string[] = []): number {
  return headers.findIndex((h) => all.every((w) => h.includes(w)) && none.every((w) => !h.includes(w)));
}

const label = (header: string, fallback: string) => {
  const m = header.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i);
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1).toLowerCase()} ${m[2]}` : fallback;
};

export function parseProjectionRows(rows: Cell[][], classification = "ANZSCO"): Omit<CareerParseResult, "fileHash"> {
  const problems: string[] = [];
  const empty = (): Omit<CareerParseResult, "fileHash"> => ({
    occupations: [],
    baselineLabel: "",
    midLabel: "",
    endLabel: "",
    classification,
    report: { rowsRead: 0, unitGroups: 0, nfdRows: 0, rowsWithoutEmployment: 0, duplicateKeys: [], problems },
  });
  const headerAt = rows.findIndex((r) => r.some((c) => /^anzsco code$/i.test(text(c))));
  if (headerAt < 0) {
    problems.push('no header row with an "ANZSCO Code" column was found');
    return empty();
  }
  // The real workbook splits the header over two rows: "Baseline" above "May 2025 ('000)", "5-Year Change" above
  // "Level ('000)" and "%". The sub-header row sits below the "ANZSCO Code" row and has no code of its own, so it is
  // joined to the header only when that cell is empty (otherwise the next row is data).
  const headerRow = rows[headerAt]!;
  const codeAt = headerRow.findIndex((c) => /^anzsco code$/i.test(text(c)));
  const below = rows[headerAt + 1] ?? [];
  const subHeader = text(below[codeAt]) === "" && below.some((c) => text(c) !== "");
  const width = Math.max(headerRow.length, subHeader ? below.length : 0);
  const clean = (v: Cell) => text(v).replace(/\s+/g, " ");
  // A group label ("5-Year Change") is merged over its Level and % columns, so it is carried right into an empty cell
  // that has a sub-header of its own.
  let group = "";
  const headers = Array.from({ length: width }, (_, i) => {
    const top = clean(headerRow[i]);
    const sub = subHeader ? clean(below[i]) : "";
    if (top) group = top;
    return `${top || (sub ? group : "")} ${sub}`.toLowerCase().trim();
  });
  const col = {
    level: findCol(headers, ["occupation level"]),
    nfd: findCol(headers, ["nfd"]),
    code: findCol(headers, ["anzsco code"]),
    name: headers.findIndex((h, i) => i !== findCol(headers, ["anzsco code"]) && /(^|\s)occupation$/.test(h)),
    skill: findCol(headers, ["skill level"]),
    base: findCol(headers, ["baseline"]),
    mid: findCol(headers, ["2030"], ["change", "share"]),
    end: findCol(headers, ["2035"], ["change", "share"]),
    c5k: findCol(headers, ["5-year", "level"]),
    c5p: findCol(headers, ["5-year", "%"]),
    c10k: findCol(headers, ["10-year", "level"]),
    c10p: findCol(headers, ["10-year", "%"]),
  };
  for (const [k, v] of Object.entries(col)) if (v < 0) problems.push(`expected column not found: ${k}`);
  if (problems.length) return empty();

  const out: Occupation[] = [];
  const seen = new Set<string>();
  const dup: string[] = [];
  let read = 0;
  for (const r of rows.slice(headerAt + 1)) {
    const level = num(r[col.level]);
    const code = text(r[col.code]);
    if (level === undefined || !code) continue; // footnotes and blank rows
    read++;
    if (![1, 2, 3, 4].includes(level)) {
      problems.push(`row for code ${code}: unknown occupation level ${level}`);
      continue;
    }
    if (!/^\d{1,4}$/.test(code) || code.length !== level) problems.push(`row for code ${code}: code does not fit level ${level}`);
    const nfd = text(r[col.nfd]).toUpperCase() === "Y";
    const key = `${level}|${code}|${nfd}`;
    if (seen.has(key)) dup.push(key);
    seen.add(key);
    const skill = text(r[col.skill]);
    const opt = <K extends string>(k: K, v: number | undefined) => (v === undefined ? {} : { [k]: v });
    out.push({
      code,
      level: level as Occupation["level"],
      nfd,
      name: text(r[col.name]),
      ...(skill ? { skillLevel: skill } : {}),
      ...opt("baselineK", num(r[col.base])),
      ...opt("midK", num(r[col.mid])),
      ...opt("endK", num(r[col.end])),
      ...opt("change5K", num(r[col.c5k])),
      ...opt("change5Pct", num(r[col.c5p])),
      ...opt("change10K", num(r[col.c10k])),
      ...opt("change10Pct", num(r[col.c10p])),
    });
  }
  if (out.length === 0) problems.push("no occupation rows were found under the header");
  if (dup.length) problems.push(`${dup.length} duplicate occupation keys`);
  return {
    occupations: out,
    baselineLabel: label(headers[col.base]!, "baseline"),
    midLabel: label(headers[col.mid]!, "mid"),
    endLabel: label(headers[col.end]!, "end"),
    classification,
    report: {
      rowsRead: read,
      unitGroups: out.filter((o) => o.level === 4 && !o.nfd).length,
      nfdRows: out.filter((o) => o.nfd).length,
      rowsWithoutEmployment: out.filter((o) => o.baselineK === undefined).length,
      duplicateKeys: dup,
      problems,
    },
  };
}

/** Reads the workbook file: the sheet whose name starts with "Table_6" holds the unit groups. */
export async function parseProjectionsFile(path: string): Promise<CareerParseResult> {
  const buf = readFileSync(path);
  const fileHash = createHash("sha256").update(buf).digest("hex");
  const sheets = (await readExcelFile(buf)) as { sheet: string; data: Cell[][] }[];
  const unit = sheets.find((s) => /^table_?\s?6\b/i.test(s.sheet));
  const dict = sheets.find((s) => /data_?dictionary/i.test(s.sheet));
  const dictText = (dict?.data ?? []).flat().map(text).join(" ");
  const classification = /ANZSCO[^.;\n]{0,40}?(\d+\.\d+)/i.exec(dictText)?.[1]
    ? `ANZSCO ${/ANZSCO[^.;\n]{0,40}?(\d+\.\d+)/i.exec(dictText)![1]}`
    : "ANZSCO";
  if (!unit) {
    const r = parseProjectionRows([], classification);
    r.report.problems.length = 0;
    r.report.problems.push(`no sheet named like "Table_6" (found: ${sheets.map((s) => s.sheet).join(", ")})`);
    return { ...r, fileHash };
  }
  return { ...parseProjectionRows(unit.data, classification), fileHash };
}
