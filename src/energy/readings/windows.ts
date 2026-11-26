/**
 * Share of a household's use that falls in each time-of-use band of a plan, taken from a readings profile.
 * Windows are local clock times (the profile is already in the household's local clock). A plan whose windows
 * cannot be mapped exactly gets a reason, never a guess.
 */
import type { TariffPeriod, TimeOfUseRate } from "../types.js";
import type { ReadingsProfile } from "./profile.js";

export interface BandShares {
  peak: number;
  shoulder: number;
  offPeak: number;
}
/** `byBand` is the share of use in each of the plan's own bands (PEAK, OFF_PEAK, SHOULDER, SHOULDER1, ...); `shares` sums them to peak, shoulder and off-peak. */
export type ShareResult = { ok: true; shares: BandShares; byBand: Record<string, number>; windows: string } | { ok: false; reason: string };

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const WEEKEND = ["SAT", "SUN"];

function minutes(t: string | undefined): number | undefined {
  const m = /^(\d{2}):?(\d{2})(?::?\d{2})?$/.exec((t ?? "").trim()); // "15:00", "1500" and "15:00:00" all appear
  return m ? +m[1]! * 60 + +m[2]! : undefined;
}

/** Months (0-11) a tariff period covers; all months when it has no dates. A month counts if the period covers its 15th. */
export function periodMonths(t: Pick<TariffPeriod, "startDate" | "endDate">): number[] {
  const parse = (s?: string) => {
    const m = /^(\d{2})-(\d{2})$/.exec(s ?? "");
    return m ? +m[1]! * 100 + +m[2]! : undefined;
  };
  const a = parse(t.startDate), b = parse(t.endDate);
  if (a === undefined || b === undefined) return [...Array(12).keys()];
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    const mid = (m + 1) * 100 + 15;
    if (a <= b ? mid >= a && mid <= b : mid >= a || mid <= b) out.push(m);
  }
  return out.length ? out : [...Array(12).keys()];
}

export function bandShares(profile: ReadingsProfile, tou: readonly TimeOfUseRate[], months: readonly number[]): ShareResult {
  const bands = tou.map((t) => ({ t, kind: t.type === "PEAK" ? "peak" : t.type === "OFF_PEAK" ? "offPeak" : /^SHOULDER\d*$/.test(t.type) ? "shoulder" : "" }));
  if (bands.some((b) => !b.kind)) return { ok: false, reason: "a time-of-use band has a type that cannot be mapped" };
  if (new Set(bands.map((b) => b.t.type)).size !== bands.length) return { ok: false, reason: "the plan has two bands of the same type" };
  // owner[dayType][slot] = band index, -1 for none
  const owner = [Array<number>(48).fill(-1), Array<number>(48).fill(-1)];
  const described: string[] = [];
  for (let bi = 0; bi < bands.length; bi++) {
    const b = bands[bi]!;
    for (const w of b.t.windows) {
      const days = new Set((w.days ?? []).map((d) => d.toUpperCase()));
      const wk = WEEKDAYS.filter((d) => days.has(d)).length;
      const we = WEEKEND.filter((d) => days.has(d)).length;
      if ((wk !== 0 && wk !== 5) || (we !== 0 && we !== 2)) return { ok: false, reason: "a window covers only some weekdays or only one weekend day, which the profile cannot separate" };
      if (wk === 0 && we === 0) continue;
      const s = minutes(w.startTime), eRaw = minutes(w.endTime);
      if (s === undefined || eRaw === undefined) return { ok: false, reason: "a window has no usable start or end time" };
      // Retailers write ends both ways: 20:59 (the last minute) and 21:00 (the end). Anything else is not on a half hour.
      const e = eRaw % 30 === 29 ? eRaw + 1 : eRaw % 30 === 0 ? eRaw : -1;
      const eMod = e === -1 ? -1 : e % 1440 === 0 ? 1440 : e;
      if (s % 30 !== 0 || eMod === -1) return { ok: false, reason: "a window does not start and end on a half hour, so it cannot be matched to half-hourly readings" };
      const slots: number[] = [];
      if (s < eMod) for (let m = s; m < eMod; m += 30) slots.push(m / 30);
      else {
        // Overnight window (for example 22:00 to 06:59): the part after midnight is counted under the same day type.
        for (let m = s; m < 1440; m += 30) slots.push(m / 30);
        for (let m = 0; m < eMod; m += 30) slots.push(m / 30);
      }
      for (const dt of [0, 1]) {
        if ((dt === 0 && wk === 0) || (dt === 1 && we === 0)) continue;
        for (const k of slots) {
          if (owner[dt]![k] !== -1 && owner[dt]![k] !== bi) return { ok: false, reason: "two bands claim the same half hour" };
          owner[dt]![k] = bi;
        }
      }
      described.push(`${b.kind} ${w.startTime}-${w.endTime}`);
    }
  }
  // Uncovered half hours go to the one band with no windows (usually off-peak); otherwise the plan has gaps.
  const empty = bands.map((b, i) => ({ i, none: b.t.windows.length === 0 })).filter((x) => x.none);
  for (const dt of [0, 1])
    for (let k = 0; k < 48; k++)
      if (owner[dt]![k] === -1) {
        if (empty.length !== 1) return { ok: false, reason: "the plan's windows leave some half hours uncovered" };
        owner[dt]![k] = empty[0]!.i;
      }
  const tot = { peak: 0, shoulder: 0, offPeak: 0 };
  const perBand = bands.map(() => 0);
  let all = 0;
  for (const m of months)
    for (const dt of [0, 1]) {
      const row = profile.sums[m * 2 + dt]!;
      for (let k = 0; k < 48; k++) {
        const bi = owner[dt]![k]!;
        tot[bands[bi]!.kind as keyof typeof tot] += row[k]!;
        perBand[bi]! += row[k]!;
        all += row[k]!;
      }
    }
  if (all <= 0) return { ok: false, reason: "the readings have no use in the months this tariff period covers" };
  const pct = (x: number) => (x / all) * 100;
  const byBand = Object.fromEntries(bands.map((b, i) => [b.t.type, pct(perBand[i]!)]));
  return { ok: true, shares: { peak: pct(tot.peak), shoulder: pct(tot.shoulder), offPeak: pct(tot.offPeak) }, byBand, windows: described.join("; ") };
}
