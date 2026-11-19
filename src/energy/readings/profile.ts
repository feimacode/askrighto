/**
 * The identifier-free profile built from a household's readings. It is what travels between the two tools:
 * `summarise_interval_readings` returns it as a string and `compare_energy_plans` takes it back and revalidates it.
 * Nothing here is stored. About 1,100 numbers: for each month, the average kWh in each half hour (market time,
 * AEST all year) for weekdays and for weekends.
 */
import { z } from "zod";
import type { ParsedReadings } from "./nem12.js";

export const PROFILE_VERSION = 1;

const slots = z.array(z.number().min(0).max(1000)).length(48);
const month = z.object({ wd: slots, we: slots, nwd: z.number().int().min(0).max(31), nwe: z.number().int().min(0).max(31) });

export const profileSchema = z.object({
  v: z.literal(PROFILE_VERSION),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(800),
  missing: z.number().int().min(0).max(800),
  /** Measured totals over the days present. */
  kwh: z.number().min(0).max(10_000_000),
  exportKwh: z.number().min(0).max(10_000_000),
  netOnly: z.boolean(),
  /** Month number "1".."12" to the averages for that month; months with no data are absent. */
  m: z.record(z.string().regex(/^(?:[1-9]|1[0-2])$/), month),
});
export type Profile = z.infer<typeof profileSchema>;

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

export function buildProfile(p: ParsedReadings): Profile {
  const acc = new Map<number, { wd: number[]; we: number[]; nwd: number; nwe: number }>();
  let kwh = 0;
  for (const [date, v] of p.consumption) {
    const m = Number(date.slice(5, 7));
    const e = acc.get(m) ?? { wd: new Array(48).fill(0), we: new Array(48).fill(0), nwd: 0, nwe: 0 };
    const weekend = isWeekend(date);
    const into = weekend ? e.we : e.wd;
    for (let k = 0; k < 48; k++) into[k]! += v[k]!;
    if (weekend) e.nwe += 1;
    else e.nwd += 1;
    acc.set(m, e);
    kwh += v.reduce((a, b) => a + b, 0);
  }
  let exp = 0;
  for (const v of p.exportKwh.values()) exp += v.reduce((a, b) => a + b, 0);
  const m: Profile["m"] = {};
  for (const [mo, e] of acc) {
    m[String(mo)] = {
      wd: e.wd.map((x) => r4(e.nwd ? x / e.nwd : 0)),
      we: e.we.map((x) => r4(e.nwe ? x / e.nwe : 0)),
      nwd: e.nwd,
      nwe: e.nwe,
    };
  }
  return { v: PROFILE_VERSION, start: p.start, end: p.end, days: p.daysPresent, missing: p.missingDates.length, kwh: r4(kwh), exportKwh: r4(exp), netOnly: p.netOnly, m };
}

export const encodeProfile = (p: Profile): string => JSON.stringify(p);

export function decodeProfile(s: string): Profile | undefined {
  try {
    const r = profileSchema.safeParse(JSON.parse(s));
    return r.success ? r.data : undefined;
  } catch {
    return undefined;
  }
}

/** Yearly kWh scaled from the days present (x 365 / days). */
export const annualKwh = (p: Profile): number => (p.kwh * 365) / p.days;
export const annualExportKwh = (p: Profile): number => (p.exportKwh * 365) / p.days;
