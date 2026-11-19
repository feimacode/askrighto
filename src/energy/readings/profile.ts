/**
 * The identifier-free profile built from parsed readings, passed between tool calls as one string so the server
 * keeps nothing. It holds, for each calendar month and for weekdays and weekends, the kWh in each half hour of the
 * household's LOCAL clock (daylight saving applied per state), summed over the days present, plus plain totals.
 * No NMI, meter serial or per-day value is in it.
 */
import type { ParsedReadings } from "./parse.js";
import type { BenchState } from "../benchmarks/types.js";

export const PROFILE_VERSION = 1;
export const MAX_PROFILE_CHARS = 40_000;

export type ReadingsState = BenchState;

export interface ReadingsProfile {
  v: 1;
  state: ReadingsState;
  /** First and last interval date, CCYY-MM-DD. */
  from: string;
  to: string;
  daysPresent: number;
  /** Missing dates inside the period, CCYY-MM-DD, at most 31 listed. */
  missing: string[];
  missingCount: number;
  /** Consumption measured over the days present, kWh. */
  totalKwh: number;
  /** Solar export (B streams) measured over the days present, kWh; absent when there is none. */
  exportKwh?: number;
  netOnly: boolean;
  streams: { consumption: string[]; export: string[] };
  nonActualDays: number;
  variableDays: number;
  outageIntervals: number;
  /** 24 rows (month 0..11 x [weekday, weekend]) of 48 half-hour kWh sums, local clock. */
  sums: number[][];
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/** Daylight saving runs from the first Sunday in October to the first Sunday in April (NSW, VIC, ACT, TAS, SA). */
function firstSunday(year: number, monthIndex: number): number {
  const dow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((7 - dow) % 7);
}
export function inDaylightSaving(state: ReadingsState, date: Date): boolean {
  if (state === "QLD") return false;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (m > 9 || m < 3) return true;
  if (m === 9) return d >= firstSunday(y, 9);
  if (m === 3) return d < firstSunday(y, 3);
  return false;
}

/** Minutes to add to market time (AEST) to get the household's local clock for that day. */
export function localOffsetMinutes(state: ReadingsState, date: Date): number {
  if (state === "QLD") return 0;
  const dst = inDaylightSaving(state, date);
  if (state === "SA") return dst ? 30 : -30;
  return dst ? 60 : 0;
}

export function buildProfile(p: ParsedReadings, state: ReadingsState): ReadingsProfile {
  const dates = [...p.consumption.keys()].sort();
  const sums: number[][] = Array.from({ length: 24 }, () => Array<number>(48).fill(0));
  let total = 0;
  for (const d of dates) {
    const y = +d.slice(0, 4), m = +d.slice(4, 6) - 1, day = +d.slice(6, 8);
    const base = new Date(Date.UTC(y, m, day));
    const off = localOffsetMinutes(state, base);
    const vals = p.consumption.get(d)!;
    for (let k = 0; k < 48; k++) {
      const local = new Date(base.getTime() + (k * 30 + off) * 60_000);
      const dow = local.getUTCDay();
      const row = local.getUTCMonth() * 2 + (dow === 0 || dow === 6 ? 1 : 0);
      const slot = local.getUTCHours() * 2 + (local.getUTCMinutes() >= 30 ? 1 : 0);
      sums[row]![slot]! += vals[k]!;
      total += vals[k]!;
    }
  }
  // Missing dates inside the period.
  const missing: string[] = [];
  let missingCount = 0;
  const first = dates[0]!, last = dates[dates.length - 1]!;
  const t0 = Date.UTC(+first.slice(0, 4), +first.slice(4, 6) - 1, +first.slice(6, 8));
  const t1 = Date.UTC(+last.slice(0, 4), +last.slice(4, 6) - 1, +last.slice(6, 8));
  const have = new Set(dates);
  for (let t = t0; t <= t1; t += 86_400_000) {
    const dt = new Date(t);
    const s = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
    if (!have.has(s)) {
      missingCount++;
      if (missing.length < 31) missing.push(iso(s));
    }
  }
  let exportTotal = 0;
  for (const d of dates) for (const v of p.exportKwh.get(d) ?? []) exportTotal += v;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    v: PROFILE_VERSION,
    state,
    from: iso(first),
    to: iso(last),
    daysPresent: dates.length,
    missing,
    missingCount,
    totalKwh: round(total),
    ...(p.exportKwh.size ? { exportKwh: round(exportTotal) } : {}),
    netOnly: p.netOnly,
    streams: p.streamsUsed,
    nonActualDays: p.nonActualDays,
    variableDays: p.variableDays,
    outageIntervals: p.outageIntervals,
    sums: sums.map((r) => r.map(round)),
  };
}

export const encodeProfile = (p: ReadingsProfile): string => JSON.stringify(p);

const STATES = new Set(["NSW", "VIC", "QLD", "SA", "TAS", "ACT"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Revalidates a profile string a host passed back. Returns the profile or the problem. */
export function decodeProfile(s: string): { ok: true; profile: ReadingsProfile } | { ok: false; problem: string } {
  if (s.length > MAX_PROFILE_CHARS) return { ok: false, problem: "the profile is longer than expected" };
  let p: ReadingsProfile;
  try {
    p = JSON.parse(s) as ReadingsProfile;
  } catch {
    return { ok: false, problem: "the profile is not valid JSON; pass the summarise_interval_readings profile unchanged" };
  }
  if (!p || typeof p !== "object" || p.v !== PROFILE_VERSION) return { ok: false, problem: "the profile has an unknown or missing version" };
  if (!STATES.has(p.state)) return { ok: false, problem: "the profile has no valid state" };
  if (!ISO.test(p.from) || !ISO.test(p.to) || p.from > p.to) return { ok: false, problem: "the profile period is not valid" };
  const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
  if (!num(p.daysPresent, 1, 800) || !num(p.missingCount, 0, 800) || !num(p.totalKwh, 0, 1_000_000) || !num(p.nonActualDays, 0, 800) || !num(p.variableDays, 0, 800) || !num(p.outageIntervals, 0, 100_000)) return { ok: false, problem: "a profile total is out of range" };
  if (p.exportKwh !== undefined && !num(p.exportKwh, 0, 1_000_000)) return { ok: false, problem: "the profile export total is out of range" };
  if (!Array.isArray(p.sums) || p.sums.length !== 24 || p.sums.some((r) => !Array.isArray(r) || r.length !== 48 || r.some((x) => !num(x, 0, 1_000_000)))) return { ok: false, problem: "the profile half-hour table has the wrong shape" };
  if (!Array.isArray(p.missing) || p.missing.length > 31 || p.missing.some((m) => !ISO.test(m))) return { ok: false, problem: "the profile missing-date list is not valid" };
  const sum = p.sums.reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0);
  if (Math.abs(sum - p.totalKwh) > Math.max(1, p.totalKwh * 0.005)) return { ok: false, problem: "the profile totals do not add up; it may have been changed" };
  if (!p.streams || !Array.isArray(p.streams.consumption) || !Array.isArray(p.streams.export)) return { ok: false, problem: "the profile streams are missing" };
  return { ok: true, profile: p };
}

/** Annual consumption: the measured total scaled from the days present to 365 days. */
export const annualKwh = (p: ReadingsProfile): number => (p.totalKwh / p.daysPresent) * 365;
export const annualExportKwh = (p: ReadingsProfile): number | undefined => (p.exportKwh === undefined ? undefined : (p.exportKwh / p.daysPresent) * 365);
