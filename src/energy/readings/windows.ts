/**
 * Works out how a household's readings fall in a plan's time-of-use windows.
 *
 * Plan windows are local clock times; the profile is in market time (AEST, no daylight saving). In a daylight saving
 * period the local clock is ahead of market time, so a window is shifted back before it is matched. SA's standard time
 * is half an hour behind market time. The weekday shift near midnight in summer is ignored (at most one hour a day,
 * and a plan whose windows differ by day of week there is rare).
 */
import type { TimeOfUseRate, TariffPeriod } from "../types.js";
import type { Profile } from "./profile.js";

export type RState = "NSW" | "VIC" | "ACT" | "TAS" | "QLD" | "SA";

export class WindowError extends Error {}

const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
// Reference year 2026 (not a leap year) for weekday counts and daylight saving dates.
const REF = 2026;

function firstSunday(year: number, month0: number): number {
  const d = new Date(Date.UTC(year, month0, 1));
  return 1 + ((7 - d.getUTCDay()) % 7);
}

/** Minutes the local clock is ahead of market time on a given day of the reference year. */
export function localOffsetMinutes(state: RState, month: number, day: number): number {
  if (state === "QLD") return 0;
  const aprilEnd = firstSunday(REF, 3);
  const octStart = firstSunday(REF, 9);
  const dst = month < 4 || (month === 4 && day < aprilEnd) || month > 10 || (month === 10 && day >= octStart);
  if (state === "SA") return dst ? 30 : -30;
  return dst ? 60 : 0;
}

const parseTime = (s: string | undefined, fallback: number): number => {
  if (s === undefined || s === "") return fallback;
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s.trim());
  if (!m) throw new WindowError(`A window time "${s}" is not a clock time.`);
  const mins = Number(m[1]) * 60 + Number(m[2]);
  if (mins > 1440) throw new WindowError(`A window time "${s}" is not a clock time.`);
  return mins;
};

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];

/** Which day types a window covers: "wd", "we" or both. Anything finer cannot be matched to the profile. */
function dayTypes(days: string[]): Array<"wd" | "we"> {
  const set = new Set(days.map((d) => d.toUpperCase()));
  for (const d of set) if (![...WEEKDAYS, "SAT", "SUN"].includes(d)) throw new WindowError(`A window uses "${d}", which cannot be matched to the readings.`);
  const wd = WEEKDAYS.every((d) => set.has(d));
  const anyWd = WEEKDAYS.some((d) => set.has(d));
  const we = set.has("SAT") && set.has("SUN");
  const anyWe = set.has("SAT") || set.has("SUN");
  if ((anyWd && !wd) || (anyWe && !we)) throw new WindowError("A window covers only some weekdays or only one weekend day, which cannot be matched to the readings.");
  return [...(wd ? (["wd"] as const) : []), ...(we ? (["we"] as const) : [])];
}

/** Whether the local half-hour starting at `startMin` (0 to 1410) is inside [from, to), wrapping midnight. */
const inWindow = (startMin: number, from: number, to: number): boolean => (from < to ? startMin >= from && startMin < to : from === to ? true : startMin >= from || startMin < to);

function dayRange(period: Pick<TariffPeriod, "startDate" | "endDate">): Array<[number, number]> {
  const parse = (s: string | undefined): [number, number] | undefined => {
    const m = /^(\d{2})-(\d{2})$/.exec(s ?? "");
    return m ? [Number(m[1]), Number(m[2])] : undefined;
  };
  const s = parse(period.startDate);
  const e = parse(period.endDate);
  const out: Array<[number, number]> = [];
  const doy = (m: number, d: number) => CUM[m - 1]! + d;
  const sd = s ? doy(...s) : 1;
  const ed = e ? doy(...e) : 365;
  for (let m = 1; m <= 12; m++)
    for (let d = 1; d <= DAYS_IN[m - 1]!; d++) {
      const x = doy(m, d);
      if (sd <= ed ? x >= sd && x <= ed : x >= sd || x <= ed) out.push([m, d]);
    }
  return out;
}

/**
 * Share (0 to 1) of the household's use falling in each time-of-use rate of one tariff period, by index.
 * Throws WindowError when the windows overlap, leave part of the day uncovered, or cannot be matched.
 */
export function windowShares(profile: Profile, state: RState, tou: TimeOfUseRate[], period: Pick<TariffPeriod, "startDate" | "endDate">): number[] {
  if (tou.some((t) => t.windows.length === 0)) throw new WindowError("A time-of-use rate has no time windows.");
  const types = tou.map((t) => t.windows.map((w) => ({ types: dayTypes(w.days), from: parseTime(w.startTime, 0), to: parseTime(w.endTime, 1440) })));
  const present = Object.keys(profile.m).map(Number);
  if (present.length === 0) throw new WindowError("The readings have no months of data.");
  const mean = (kind: "wd" | "we"): number[] => {
    const out = new Array(48).fill(0);
    for (const mo of present) for (let k = 0; k < 48; k++) out[k]! += profile.m[String(mo)]![kind][k]! / present.length;
    return out;
  };
  const fill = { wd: mean("wd"), we: mean("we") };
  const sums = new Array(tou.length).fill(0);
  let total = 0;
  for (const [m, d] of dayRange(period)) {
    const weekend = ((new Date(Date.UTC(REF, m - 1, d)).getUTCDay() + 6) % 7) >= 5;
    const kind = weekend ? "we" : "wd";
    const pm = profile.m[String(m)];
    const prof = pm && (weekend ? pm.nwe : pm.nwd) > 0 ? pm[kind] : fill[kind];
    const off = localOffsetMinutes(state, m, d);
    for (let k = 0; k < 48; k++) {
      const local = (((k * 30 + off) % 1440) + 1440) % 1440;
      const hits: number[] = [];
      types.forEach((ws, i) => {
        if (ws.some((w) => w.types.includes(kind) && inWindow(local, w.from, w.to))) hits.push(i);
      });
      if (hits.length === 0) throw new WindowError("The plan's time windows leave part of the day uncovered.");
      if (hits.length > 1) throw new WindowError("The plan's time windows overlap.");
      sums[hits[0]!]! += prof[k]!;
      total += prof[k]!;
    }
  }
  if (total <= 0) throw new WindowError("The readings have no use in this tariff period.");
  return sums.map((s) => s / total);
}
