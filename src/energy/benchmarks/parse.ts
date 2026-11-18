/**
 * Reads the AER "Simple electricity and gas benchmarks" workbook. Values are kept exactly as published.
 * Sheets: "Climate zone 1".."8" and the state gas sheets are long format (season, state or region, household size,
 * benchmark) from a header row found by its text; "SA zones" has seasons as columns; "Postcode mapping" holds two
 * side-by-side lists. Problems are collected, not thrown, so `benchmarks:validate` can print them all.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import readExcelFile from "read-excel-file/node";
import { stateOfPostcode } from "./state.js";
import { SEASONS, type BenchmarkRow, type PostcodeRow, type Season } from "./types.js";

type Cell = string | number | boolean | Date | null | undefined;
type Sheet = { sheet: string; data: Cell[][] };

export const GAS_SHEETS = ["ACT", "NSW", "QLD", "SA", "TAS", "VIC"] as const;
const BENCH_STATES = new Set<string>(GAS_SHEETS);

export interface BenchmarkParseReport {
  /** Rows read per sheet name. */
  sheetRows: Record<string, number>;
  benchmarkRows: number;
  postcodeRows: number;
  climatePostcodes: number;
  saPostcodes: number;
  /** Postcodes in neither list or with a zone that has no sheet. */
  postcodesWithoutZone: string[];
  duplicateKeys: string[];
  nonPositiveValues: string[];
  /** Incomplete (fuel, zone, state): not exactly four seasons by five household sizes. */
  incompleteGroups: string[];
  /** Postcodes whose state (from the postcode range) is not one of the states in their zone sheet. */
  postcodesStateNotInZone: string[];
  /** Postcodes in the SA zone list that do not sit in the SA postcode range. */
  saZonePostcodesOutsideSa: string[];
  /** True if every Climate zone 8 value equals Climate zone 7 for the same state, season and size. */
  zone8EqualsZone7: boolean;
  /** Climate zone numbers used by the postcode sheet. */
  zonesUsed: number[];
  problems: string[];
}

export interface BenchmarkParseResult {
  rows: BenchmarkRow[];
  postcodes: PostcodeRow[];
  fileHash: string;
  report: BenchmarkParseReport;
}

const text = (v: Cell) => (v === null || v === undefined ? "" : String(v).trim());
const isSeason = (s: string): s is Season => (SEASONS as readonly string[]).includes(s);
const sizeOf = (v: Cell): BenchmarkRow["size"] | undefined => {
  const s = text(v);
  if (s === "5+") return 5;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? (n as 1 | 2 | 3 | 4) : undefined;
};
const headerAt = (rows: Cell[][], test: (r: Cell[]) => boolean) => rows.findIndex(test);

export function parseBenchmarkSheets(sheets: Sheet[]): Omit<BenchmarkParseResult, "fileHash"> {
  const problems: string[] = [];
  const rows: BenchmarkRow[] = [];
  const sheetRows: Record<string, number> = {};
  const dup: string[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();

  const add = (r: BenchmarkRow) => {
    const key = `${r.fuel}|${r.zone}|${r.state}|${r.size}|${r.season}`;
    if (seen.has(key)) dup.push(key);
    seen.add(key);
    if (!(r.value > 0) || !Number.isFinite(r.value)) bad.push(`${key}=${r.value}`);
    rows.push(r);
  };

  // Long-format sheets: electricity by climate zone, gas by state. Only the left-hand table (columns B to E) is read.
  const readLong = (s: Sheet, fuel: "ELECTRICITY" | "GAS", zone: string, valueHead: RegExp, unit: "kWh" | "MJ") => {
    const h = headerAt(s.data, (r) => text(r[1]) === "Season" && /^(state|region)$/i.test(text(r[2])) && /household size/i.test(text(r[3])) && valueHead.test(text(r[4])));
    if (h < 0) {
      problems.push(`sheet "${s.sheet}": no header row (Season, State or Region, Household size, ${unit})`);
      return;
    }
    let n = 0;
    for (const r of s.data.slice(h + 1)) {
      const season = text(r[1]);
      if (!isSeason(season)) break;
      const size = sizeOf(r[3]);
      const value = r[4];
      if (size === undefined || typeof value !== "number") {
        problems.push(`sheet "${s.sheet}": unreadable row ${JSON.stringify(r.slice(1, 5))}`);
        continue;
      }
      add({ fuel, zone, state: text(r[2]), size, season, value, unit, sheet: s.sheet });
      n++;
    }
    sheetRows[s.sheet] = n;
  };

  for (const s of sheets) {
    const z = /^climate zone (\d)$/i.exec(s.sheet.trim());
    if (z) readLong(s, "ELECTRICITY", z[1]!, /^benchmark \(kwh\)$/i, "kWh");
    else if ((GAS_SHEETS as readonly string[]).includes(s.sheet.trim())) readLong(s, "GAS", s.sheet.trim(), /^benchmark \(mj\)$/i, "MJ");
  }

  // South Australian zones: seasons as columns. The AER header has a typo ("Autralian"), so match loosely.
  const sa = sheets.find((s) => /^sa zones$/i.test(s.sheet.trim()));
  if (!sa) problems.push('no "SA zones" sheet');
  else {
    const h = headerAt(sa.data, (r) => /south aus?tralian zone/i.test(text(r[1])) && /household size/i.test(text(r[2])) && /^summer/i.test(text(r[3])));
    if (h < 0) problems.push('sheet "SA zones": no header row');
    else {
      let n = 0;
      for (const r of sa.data.slice(h + 1)) {
        const zone = text(r[1]);
        if (!zone) break;
        const size = sizeOf(r[2]);
        if (size === undefined) {
          problems.push(`sheet "SA zones": unreadable household size in ${JSON.stringify(r.slice(1, 3))}`);
          continue;
        }
        SEASONS.forEach((season, i) => {
          const value = r[3 + i];
          if (typeof value !== "number") {
            problems.push(`sheet "SA zones": ${zone} size ${size} ${season} is not a number`);
            return;
          }
          add({ fuel: "ELECTRICITY", zone, state: "SA", size, season, value, unit: "kWh", sheet: "SA zones" });
          n++;
        });
      }
      sheetRows["SA zones"] = n;
    }
  }

  // Postcode mapping: B postcode, C climate zone; E postcode, F South Australian zone.
  const postcodes = new Map<string, PostcodeRow>();
  const pm = sheets.find((s) => /^postcode mapping$/i.test(s.sheet.trim()));
  let climateN = 0;
  let saN = 0;
  const saZonePostcodesOutsideSa: string[] = [];
  const zonesUsed = new Set<number>();
  const noZone: string[] = [];
  if (!pm) problems.push('no "Postcode mapping" sheet');
  else {
    const h = headerAt(pm.data, (r) => /^postcode$/i.test(text(r[1])) && /^climate zone$/i.test(text(r[2])) && /^postcode$/i.test(text(r[4])));
    if (h < 0) problems.push('sheet "Postcode mapping": no header row');
    else {
      const pc = (v: Cell) => (typeof v === "number" ? String(v).padStart(4, "0") : text(v));
      for (const r of pm.data.slice(h + 1)) {
        if (r[1] !== null && r[1] !== undefined && text(r[1]) !== "") {
          const p = pc(r[1]);
          const zone = typeof r[2] === "number" ? r[2] : Number(text(r[2]));
          if (!/^\d{4}$/.test(p) || !Number.isInteger(zone)) noZone.push(p || JSON.stringify(r.slice(1, 3)));
          else {
            const e = postcodes.get(p) ?? { postcode: p };
            if (e.climateZone !== undefined) dup.push(`postcode ${p} listed twice (climate zone)`);
            e.climateZone = zone;
            postcodes.set(p, e);
            zonesUsed.add(zone);
            climateN++;
          }
        }
        if (r[4] !== null && r[4] !== undefined && text(r[4]) !== "") {
          const p = pc(r[4]);
          const z = text(r[5]);
          if (!/^\d{4}$/.test(p) || !z) noZone.push(p || JSON.stringify(r.slice(4, 6)));
          else {
            const e = postcodes.get(p) ?? { postcode: p };
            if (e.saZone !== undefined) dup.push(`postcode ${p} listed twice (SA zone)`);
            e.saZone = z;
            postcodes.set(p, e);
            if (stateOfPostcode(p) !== "SA") saZonePostcodesOutsideSa.push(p);
            saN++;
          }
        }
      }
      sheetRows["Postcode mapping"] = climateN + saN;
    }
  }

  // Cross-checks.
  const groups = new Map<string, number>();
  for (const r of rows) groups.set(`${r.fuel}|${r.zone}|${r.state}`, (groups.get(`${r.fuel}|${r.zone}|${r.state}`) ?? 0) + 1);
  const incompleteGroups = [...groups].filter(([, n]) => n !== SEASONS.length * 5).map(([k, n]) => `${k} has ${n} values`);
  const statesIn = new Map<string, Set<string>>(); // electricity climate zone -> states in its sheet
  for (const r of rows) if (r.fuel === "ELECTRICITY" && r.sheet !== "SA zones") (statesIn.get(r.zone) ?? statesIn.set(r.zone, new Set()).get(r.zone)!).add(r.state);
  const saZones = new Set(rows.filter((r) => r.sheet === "SA zones").map((r) => r.zone));
  const zoneSheets = new Set(statesIn.keys());
  const badZone: string[] = [...noZone];
  const stateMismatch: string[] = [];
  for (const p of postcodes.values()) {
    if (p.climateZone !== undefined && !zoneSheets.has(String(p.climateZone))) badZone.push(`${p.postcode} (zone ${p.climateZone} has no sheet)`);
    if (p.saZone !== undefined && !saZones.has(p.saZone)) badZone.push(`${p.postcode} (SA zone "${p.saZone}" has no benchmarks)`);
    const st = stateOfPostcode(p.postcode);
    if (p.climateZone !== undefined && st && !statesIn.get(String(p.climateZone))?.has(st) && !(st === "SA" && p.saZone !== undefined)) stateMismatch.push(`${p.postcode} ${st} zone ${p.climateZone}`);
  }
  const at = (zone: string) => new Map(rows.filter((r) => r.fuel === "ELECTRICITY" && r.zone === zone).map((r) => [`${r.state}|${r.size}|${r.season}`, r.value]));
  const z7 = at("7");
  const z8 = at("8");
  const zone8EqualsZone7 = z8.size > 0 && z8.size === z7.size && [...z8].every(([k, v]) => z7.get(k) === v);

  for (const st of BENCH_STATES) if (!rows.some((r) => r.fuel === "GAS" && r.zone === st)) problems.push(`no gas benchmarks for ${st}`);
  for (let z = 1; z <= 8; z++) if (!zoneSheets.has(String(z))) problems.push(`no electricity benchmarks for climate zone ${z}`);
  if (saZones.size !== 10) problems.push(`expected ten South Australian zones, found ${saZones.size}`);
  if (badZone.length) problems.push(`${badZone.length} postcode(s) with no usable zone`);
  if (dup.length) problems.push(`${dup.length} duplicate key(s)`);
  if (bad.length) problems.push(`${bad.length} value(s) that are not positive numbers`);
  if (incompleteGroups.length) problems.push(`${incompleteGroups.length} incomplete benchmark group(s)`);
  if (!rows.length) problems.push("no benchmark rows were found");
  if (!postcodes.size) problems.push("no postcode rows were found");

  return {
    rows,
    postcodes: [...postcodes.values()].sort((a, b) => a.postcode.localeCompare(b.postcode)),
    report: {
      sheetRows,
      benchmarkRows: rows.length,
      postcodeRows: postcodes.size,
      climatePostcodes: climateN,
      saPostcodes: saN,
      postcodesWithoutZone: badZone,
      duplicateKeys: dup,
      nonPositiveValues: bad,
      incompleteGroups,
      postcodesStateNotInZone: stateMismatch,
      saZonePostcodesOutsideSa,
      zone8EqualsZone7,
      zonesUsed: [...zonesUsed].sort((a, b) => a - b),
      problems,
    },
  };
}

export async function parseBenchmarkFile(path: string): Promise<BenchmarkParseResult> {
  const buf = readFileSync(path);
  const fileHash = createHash("sha256").update(buf).digest("hex");
  const sheets = (await readExcelFile(buf)) as Sheet[];
  return { ...parseBenchmarkSheets(sheets), fileHash };
}
