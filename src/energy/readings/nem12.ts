/**
 * Reads the text of a NEM12 interval meter data file (AEMO Meter Data File Format specification) in memory.
 *
 * Tolerant of what real exports do (checked against a real distributor export, 19 Nov 2026): no 100 header or
 * 900 end record, a last line missing its trailing field, blank reason fields. Strict about what would make a figure
 * wrong: a non-number, a day with the wrong number of values, a second NMI, a repeated date.
 *
 * Privacy: the NMI and meter serial are used only to tell households and meters apart, never kept. Errors name the
 * line number and the problem, never the line's content.
 *
 * Streams follow the AEMO NMI Procedure, section 7, Table 1 (names are from the grid's side): a suffix starting `E`
 * (energy delivered to the household) is main consumption, `B` (energy sent into the grid) is solar export. Controlled
 * load cannot be told from main consumption by suffix, so it is not separated.
 */

export class ReadingsError extends Error {
  constructor(message: string, readonly kind: "not_nem12" | "refused" | "bad_line" | "too_big" = "refused") {
    super(message);
  }
}

export interface ParsedReadings {
  /** First and last date with consumption, YYYY-MM-DD. */
  start: string;
  end: string;
  /** Dates in [start, end] with no consumption record, YYYY-MM-DD. */
  missingDates: string[];
  daysPresent: number;
  /** Consumption per day: 48 half-hour kWh values (market time), keyed by YYYY-MM-DD. */
  consumption: Map<string, number[]>;
  /** Export per day, same shape; empty when the file has no export stream. */
  exportKwh: Map<string, number[]>;
  /** Suffixes used, e.g. ["E1","B1"] (suffixes only, no identifier). */
  streams: { consumption: string[]; export: string[]; ignored: string[] };
  netOnly: boolean;
  quality: { dayFlags: Record<string, number>; nonActualIntervals: number; outageEvents: number };
  intervalMinutes: number[];
}

export const DEFAULT_MAX_CHARS = 600_000;

interface Block {
  suffix: string;
  unit: number; // multiplier to kWh, 0 means not energy
  interval: number;
  days: Map<string, number[]>;
  dayFlags: Map<string, string>;
}

const num = /^-?\d+(\.\d+)?$/;

function iso(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function unitFactor(u: string): number {
  const x = u.trim().toUpperCase();
  if (x === "KWH") return 1;
  if (x === "WH") return 0.001;
  if (x === "MWH") return 1000;
  return 0;
}

function nextDay(s: string): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseNem12(text: string, maxChars = DEFAULT_MAX_CHARS): ParsedReadings {
  if (text.length > maxChars) throw new ReadingsError(`The file is over the size limit of ${maxChars.toLocaleString("en-AU")} characters. Ask for a shorter date range (for example one year) and try again.`, "too_big");
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let cur: Block | undefined;
  let curDay: string | undefined;
  let nmi: string | undefined;
  let sawNem12 = false;
  let nonActual = 0;
  let outages = 0;
  let any = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw) continue;
    const f = raw.split(",");
    const rec = f[0]!.trim();
    const ln = i + 1;
    if (rec === "100") {
      if (f[1]?.trim().toUpperCase() === "NEM13") throw new ReadingsError("This is an accumulation (NEM13, meter reading) file with no half-hourly figures, so it cannot cost time-of-use plans. Ask for interval data (NEM12).", "refused");
      if (f[1]?.trim().toUpperCase() !== "NEM12") throw new ReadingsError(`Line ${ln}: the header is not NEM12.`, "not_nem12");
      sawNem12 = true;
    } else if (rec === "250") {
      throw new ReadingsError("This is an accumulation (NEM13, meter reading) file with no half-hourly figures, so it cannot cost time-of-use plans. Ask for interval data (NEM12).", "refused");
    } else if (rec === "200") {
      sawNem12 = true;
      any = true;
      const thisNmi = (f[1] ?? "").trim();
      if (!thisNmi) throw new ReadingsError(`Line ${ln}: a 200 record has no NMI.`, "bad_line");
      if (nmi !== undefined && nmi !== thisNmi) throw new ReadingsError("The file holds more than one NMI (more than one meter point). Ask for one household's file at a time.", "refused");
      nmi = thisNmi;
      const suffix = (f[4] ?? "").trim().toUpperCase();
      const interval = Number((f[8] ?? "").trim());
      if (!/^[A-Z0-9]{2}$/.test(suffix)) throw new ReadingsError(`Line ${ln}: a 200 record has no valid data stream suffix.`, "bad_line");
      if (![1, 5, 15, 30].includes(interval)) throw new ReadingsError(`Line ${ln}: the interval length is not 5, 15 or 30 minutes.`, "bad_line");
      cur = { suffix, unit: unitFactor(f[7] ?? ""), interval, days: new Map(), dayFlags: new Map() };
      curDay = undefined;
      blocks.push(cur);
    } else if (rec === "300") {
      if (!cur) throw new ReadingsError(`Line ${ln}: an interval record comes before any 200 record.`, "bad_line");
      const date = (f[1] ?? "").trim();
      if (!/^\d{8}$/.test(date)) throw new ReadingsError(`Line ${ln}: the date is not CCYYMMDD.`, "bad_line");
      const n = 1440 / cur.interval;
      if (cur.unit === 0) {
        // Not an energy stream (reactive power and similar): ignored whole.
        curDay = undefined;
        continue;
      }
      if (f.length < 2 + n) throw new ReadingsError(`Line ${ln}: the day has fewer than ${n} values.`, "bad_line");
      const flag = (f[2 + n] ?? "").trim().toUpperCase();
      const vals: number[] = [];
      for (let k = 0; k < n; k++) {
        const v = (f[2 + k] ?? "").trim();
        if (!num.test(v)) {
          if (flag.startsWith("N") && v === "") {
            vals.length = 0;
            break;
          }
          throw new ReadingsError(`Line ${ln}: value ${k + 1} is not a number.`, "bad_line");
        }
        const x = Number(v);
        if (x < 0) throw new ReadingsError(`Line ${ln}: value ${k + 1} is negative.`, "bad_line");
        vals.push(x * cur.unit);
      }
      const day = iso(date);
      if (cur.days.has(day)) throw new ReadingsError(`Line ${ln}: the date appears twice in one data stream.`, "bad_line");
      curDay = day;
      if (vals.length === 0) continue; // null day: treated as missing
      // Sum finer intervals to 30 minutes.
      const per = Math.max(1, 30 / cur.interval);
      const half: number[] = new Array(48).fill(0);
      for (let k = 0; k < vals.length; k++) half[Math.floor(k / per)]! += vals[k]!;
      cur.days.set(day, half);
      cur.dayFlags.set(day, flag.slice(0, 1) || "A");
    } else if (rec === "400") {
      if (!cur || curDay === undefined || cur.unit === 0) continue;
      const a = Number(f[1]);
      const b = Number(f[2]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a) throw new ReadingsError(`Line ${ln}: a 400 record has a bad interval range.`, "bad_line");
      const q = (f[3] ?? "").trim().toUpperCase();
      if (q && !q.startsWith("A")) nonActual += b - a + 1;
      if ((f[4] ?? "").trim() === "79") outages += 1;
    } else if (rec === "900" || rec === "500" || rec === "550") {
      // End of file or B2B details: nothing to read.
    } else if (/^\d{3}$/.test(rec) && sawNem12) {
      // Unknown record type inside a NEM12 file: skip it.
    } else {
      throw new ReadingsError(`Line ${ln}: this is not a NEM12 interval file.`, "not_nem12");
    }
  }
  if (!any) throw new ReadingsError("This does not look like a NEM12 interval file (no 200 records).", "not_nem12");

  // Pick streams by first character, in order of preference within each direction.
  const energy = blocks.filter((b) => b.unit > 0);
  const byFirst = (c: string) => energy.filter((b) => b.suffix.startsWith(c));
  const numeric = energy.some((b) => /^\d/.test(b.suffix));
  if (numeric) throw new ReadingsError("The file has numbered data streams (type 6 accumulation data), not interval streams. Ask for interval data.", "refused");
  const pick = (order: string[]): Block[] => {
    for (const c of order) {
      const m = byFirst(c);
      if (m.length) return m;
    }
    return [];
  };
  let cons = pick(["E", "F", "D"]);
  const exp = pick(["B", "C", "A"]);
  let netOnly = false;
  if (cons.length === 0) {
    const n = byFirst("N");
    if (n.length === 0) throw new ReadingsError("The file has no consumption stream (no E or N data stream). Ask for the interval data for electricity used.", "refused");
    cons = n;
    netOnly = true;
  }
  const sumDays = (bs: Block[]): Map<string, number[]> => {
    const out = new Map<string, number[]>();
    for (const b of bs)
      for (const [d, v] of b.days) {
        const e = out.get(d) ?? new Array(48).fill(0);
        for (let k = 0; k < 48; k++) e[k]! += v[k]!;
        out.set(d, e);
      }
    return out;
  };
  const consumption = sumDays(cons);
  if (consumption.size === 0) throw new ReadingsError("The file has no usable days of consumption.", "refused");
  const exportAll = netOnly ? new Map<string, number[]>() : sumDays(exp);
  const exportKwh = new Map<string, number[]>();
  for (const [d, v] of exportAll) if (consumption.has(d)) exportKwh.set(d, v);

  const dates = [...consumption.keys()].sort();
  const start = dates[0]!;
  const end = dates[dates.length - 1]!;
  const missing: string[] = [];
  for (let d = start; d <= end; d = nextDay(d)) if (!consumption.has(d)) missing.push(d);

  const dayFlags: Record<string, number> = {};
  for (const b of cons) for (const f of b.dayFlags.values()) dayFlags[f] = (dayFlags[f] ?? 0) + 1;
  const ignored = [...new Set(blocks.filter((b) => !cons.includes(b) && !(netOnly ? false : exp.includes(b))).map((b) => b.suffix))];
  return {
    start,
    end,
    missingDates: missing,
    daysPresent: consumption.size,
    consumption,
    exportKwh,
    streams: { consumption: cons.map((b) => b.suffix), export: netOnly ? [] : exp.map((b) => b.suffix), ignored },
    netOnly,
    quality: { dayFlags, nonActualIntervals: nonActual, outageEvents: outages },
    intervalMinutes: [...new Set(blocks.map((b) => b.interval))].sort((a, b) => a - b),
  };
}
