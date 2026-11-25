/**
 * A seeded NEM12 generator for tests: a household with a seasonal load, optional controlled load (E2, E3, ...)
 * and optional solar export (B1, B2, ...), with exact totals when asked.
 *
 * Ported from the generator Iven shared (seasonal household load, E1 household plus E2+ controlled load streams,
 * B solar streams, --consumption / --feedin exact totals), with these changes for tests:
 * a seeded PRNG instead of Math.random (the same seed gives the same text), a required start date, the invented NMI
 * 6407000123 by default, an importable function that returns the text, and optional 5-minute intervals.
 * Every number is invented; no real file is ever used or committed. scripts/make-sample-readings.mjs is separate.
 */

export const DEFAULT_NMI = "6407000123";

export interface Nem12Options {
  /** First day, CCYY-MM-DD or CCYYMMDD. Required: the season depends on it. */
  start: string;
  /** Days to write. Default 365. */
  days?: number;
  /** Same seed, same text. Default 1. */
  seed?: number;
  /** Default 6407000123 (invented). */
  nmi?: string;
  /** 30 (default) or 5. 15 also works. */
  intervalMinutes?: 5 | 15 | 30;
  /** Exact total kWh bought from the grid over the whole file, all E streams together. Default: dailyKwh x days. */
  consumptionKwh?: number;
  /** Mean kWh a day when consumptionKwh is not given. Default 12. */
  dailyKwh?: number;
  /** Controlled load streams, E2 to E(n+1). Default 0. They take `controlledLoadShare` of the consumption between them. */
  controlledLoadStreams?: number;
  /** Share of consumption on the controlled load streams. Default 0.15. */
  controlledLoadShare?: number;
  /** Solar export streams, B1 to Bn. Default 0, or 1 when feedinKwh is given. */
  solarStreams?: number;
  /** Exact total kWh exported over the whole file, all B streams together. Default: 8 x days when there is solar. */
  feedinKwh?: number;
  /** Write the 100 header and 900 trailer, as a real file has. Default true. */
  envelope?: boolean;
}

export interface Nem12Stream {
  suffix: string;
  /** kWh per interval, in 1e-4 steps, one array per day. */
  days: Array<{ date: string; values: number[] }>;
}

export interface Nem12Data {
  text: string;
  nmi: string;
  intervalMinutes: number;
  /** Date (CCYYMMDD) of each day written, in order. */
  dates: string[];
  streams: Nem12Stream[];
}

/** mulberry32: a small seeded generator. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ccyymmdd = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};

function parseStart(s: string): number {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(s ?? "");
  if (!m) throw new Error(`nem12: start must be CCYY-MM-DD or CCYYMMDD, got ${JSON.stringify(s)}`);
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
}

/** Share out `total` (in whole 1e-4 units) over `weights`, so the integer parts add up to exactly `total`. */
function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k]![1]]!++;
  return out;
}

const dayOfYear = (t: number) => Math.floor((t - Date.UTC(new Date(t).getUTCFullYear(), 0, 1)) / 86_400_000);

/** Household load for a half hour slot (0..47) of a day: morning and evening peaks, a low night, flatter weekends. */
function householdShape(slot: number, weekend: boolean): number {
  const h = slot / 2;
  const bump = (centre: number, width: number, height: number) => height * Math.exp(-((h - centre) ** 2) / (2 * width ** 2));
  const base = 0.25;
  return base + bump(7.5, 1.2, weekend ? 0.3 : 0.45) + bump(12.5, 2, weekend ? 0.3 : 0.1) + bump(19, 2.2, weekend ? 0.9 : 1.0);
}

/** Heating in winter and cooling in summer both lift the load; spring and autumn are lowest (southern hemisphere). */
function seasonFactor(t: number): number {
  const doy = dayOfYear(t);
  return 1 + 0.12 * Math.cos((2 * Math.PI * (doy - 196)) / 365) + 0.18 * Math.cos((4 * Math.PI * (doy - 196)) / 365);
}

/** Controlled load runs overnight, 23:00 to 06:00. */
const controlledShape = (slot: number) => (slot >= 46 || slot < 12 ? 1 : 0.02);

/** Daylight: a bell between sunrise and sunset, longer days in summer. */
function solarShape(slot: number, t: number): number {
  const doy = dayOfYear(t);
  const half = 5.5 + 1.7 * Math.cos((2 * Math.PI * (doy - 355)) / 365); // half day length in hours around 12:30
  const h = slot / 2 + 0.25;
  const x = (h - 12.5) / half;
  return Math.abs(x) >= 1 ? 0 : Math.cos((x * Math.PI) / 2) ** 2;
}

export function generateNem12Data(o: Nem12Options): Nem12Data {
  const start = parseStart(o.start);
  const days = o.days ?? 365;
  const per = o.intervalMinutes ?? 30;
  if (![5, 15, 30].includes(per)) throw new Error("nem12: intervalMinutes must be 5, 15 or 30");
  if (!Number.isInteger(days) || days < 1) throw new Error("nem12: days must be a positive whole number");
  const nmi = o.nmi ?? DEFAULT_NMI;
  const clStreams = o.controlledLoadStreams ?? 0;
  const solarStreams = o.solarStreams ?? (o.feedinKwh !== undefined ? 1 : 0);
  const clShare = clStreams ? (o.controlledLoadShare ?? 0.15) : 0;
  const rand = prng(o.seed ?? 1);
  const perDay = 1440 / per;
  const split = 30 / per; // intervals per half hour; a half hour's use is spread over them
  const dates: string[] = [];
  const stamps: number[] = [];
  for (let i = 0; i < days; i++) {
    const t = start + i * 86_400_000;
    stamps.push(t);
    dates.push(ccyymmdd(t));
  }

  // Weights first (the shape of the load), then exact apportioning to the totals.
  const weightsFor = (kind: "home" | "cl" | "solar"): number[] => {
    const w: number[] = [];
    for (const t of stamps) {
      const dow = new Date(t).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const dayNoise = 0.85 + 0.3 * rand(); // a cloudy or a busy day
      const sunny = 0.35 + 0.65 * rand();
      for (let k = 0; k < perDay; k++) {
        const slot = Math.floor(k / split);
        let v: number;
        if (kind === "home") v = householdShape(slot, weekend) * seasonFactor(t) * dayNoise * (0.9 + 0.2 * rand());
        else if (kind === "cl") v = controlledShape(slot) * (0.8 + 0.4 * rand());
        else v = solarShape(slot, t) * sunny * (kind === "solar" ? 1 : 0);
        w.push(v + 1e-9);
      }
    }
    return w;
  };

  const totalConsumption = o.consumptionKwh ?? (o.dailyKwh ?? 12) * days;
  const clUnits = Math.round(totalConsumption * clShare * 1e4);
  const homeUnits = Math.round(totalConsumption * 1e4) - clUnits;
  const streams: Nem12Stream[] = [];
  const toStream = (suffix: string, units: number[]): Nem12Stream => ({
    suffix,
    days: dates.map((date, i) => ({ date, values: units.slice(i * perDay, (i + 1) * perDay).map((u) => u / 1e4) })),
  });
  streams.push(toStream("E1", apportion(weightsFor("home"), homeUnits)));
  if (clStreams) {
    const each = apportion(Array<number>(clStreams).fill(1), clUnits);
    for (let s = 0; s < clStreams; s++) streams.push(toStream(`E${s + 2}`, apportion(weightsFor("cl"), each[s]!)));
  }
  if (solarStreams) {
    const totalFeedin = o.feedinKwh ?? 8 * days;
    const each = apportion(Array<number>(solarStreams).fill(1), Math.round(totalFeedin * 1e4));
    for (let s = 0; s < solarStreams; s++) streams.push(toStream(`B${s + 1}`, apportion(weightsFor("solar"), each[s]!)));
  }

  const lines: string[] = [];
  if (o.envelope !== false) lines.push("100,NEM12,202611191200,UNITEDP,RETAILX");
  streams.forEach((st, i) => {
    lines.push(`200,${nmi},${st.suffix},${st.suffix},${st.suffix},,SERIAL${pad(i + 1)},KWH,${per},`);
    for (const d of st.days) lines.push(`300,${d.date},${d.values.map((v) => v.toFixed(4)).join(",")},A,,,${d.date}120000,`);
  });
  if (o.envelope !== false) lines.push("900");
  return { text: lines.join("\n"), nmi, intervalMinutes: per, dates, streams };
}

/** The NEM12 text alone. */
export const generateNem12 = (o: Nem12Options): string => generateNem12Data(o).text;
