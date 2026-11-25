/**
 * A seeded NEM12 generator for tests: a household with a seasonal load, optional controlled load (E2, E3, ...)
 * and optional solar export (B1, B2, ...), with exact totals when asked.
 *
 * Ported from the generator Iven shared (gen-nem12.js) with these changes for tests: a seeded PRNG instead of
 * Math.random (the same seed gives the same text), a required start date, the invented NMI 6407000123 by default,
 * an importable function that returns the text, and optional 5- or 15-minute intervals.
 * Kept from the original: the load shape (morning and evening peaks, weekend midday, winter heating), controlled load
 * 23:00 to 07:00, solar as a sine with a cloud factor, E1 net of solar and export as generation minus household load,
 * totals scaled per group (E or B) to whole Wh with the rounding remainder on the largest interval, registers
 * ordered B before E with a config string, and a 500 record carrying the register index.
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
  /** 30 (default), 15 or 5. */
  intervalMinutes?: 5 | 15 | 30;
  /** Exact total kWh bought from the grid over the whole file, all E streams together. Default: as generated. */
  consumptionKwh?: number;
  /** Controlled load streams, E2 to E(n+1), on top of the household stream E1. Default 0. */
  controlledLoadStreams?: number;
  /** Solar streams, B1 to Bn. Default 0, or 1 when feedinKwh is given. */
  solarStreams?: number;
  /** Exact total kWh exported over the whole file, all B streams together. Default: as generated. */
  feedinKwh?: number;
  /** Register reading before the first day, for the 500 records. Default 1000. */
  openingIndex?: number;
  /** Write the 100 header and 900 trailer, as a real file has. Default true. */
  envelope?: boolean;
}

export interface Nem12Stream {
  suffix: string;
  /** kWh per interval (whole Wh), one array per day. */
  days: Array<{ date: string; values: number[] }>;
}

export interface Nem12Data {
  text: string;
  nmi: string;
  intervalMinutes: number;
  /** Date (CCYYMMDD) of each day written, in order. */
  dates: string[];
  /** Registers in file order: B before E. */
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

const dayOfYear = (t: number) => Math.floor((t - Date.UTC(new Date(t).getUTCFullYear(), 0, 1)) / 86_400_000) + 1;

/** Scale a group's values to sum to `targetKwh`, round to whole Wh and put the rounding remainder on the largest interval. */
function toWh(values: number[], targetKwh: number | undefined): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  if (targetKwh === undefined) return values.map((v) => Math.round(v * 1000));
  if (sum <= 0) throw new Error("nem12: the profile has no usage to scale to the target");
  const wh = values.map((v) => Math.round((v * targetKwh * 1000) / sum));
  const remainder = Math.round(targetKwh * 1000) - wh.reduce((a, b) => a + b, 0);
  let big = 0;
  wh.forEach((v, i) => { if (v > wh[big]!) big = i; });
  wh[big]! += remainder;
  return wh;
}

export function generateNem12Data(o: Nem12Options): Nem12Data {
  const start = parseStart(o.start);
  const days = o.days ?? 365;
  const per = o.intervalMinutes ?? 30;
  if (![5, 15, 30].includes(per)) throw new Error("nem12: intervalMinutes must be 5, 15 or 30");
  if (!Number.isInteger(days) || days < 1) throw new Error("nem12: days must be a positive whole number");
  const nmi = o.nmi ?? DEFAULT_NMI;
  const eCount = 1 + (o.controlledLoadStreams ?? 0);
  const bCount = o.solarStreams ?? (o.feedinKwh !== undefined ? 1 : 0);
  const rand = prng(o.seed ?? 1);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(ccyymmdd(start + i * 86_400_000));

  const cloudChoices = [1, 1, 1, 1, 1, 1, 0.75, 0.5, 0.3];
  const eSize = Array.from({ length: eCount }, (_, i) => (i === 0 ? 1 : between(0.25, 0.5)));
  const bSize = Array.from({ length: bCount }, () => between(1.2, 2.2));
  // Half-hour kWh per register, in file order: day by day, 48 values.
  const e: number[][] = Array.from({ length: eCount }, () => []);
  const bExport: number[][] = Array.from({ length: bCount }, () => []);

  for (let d = 0; d < days; d++) {
    const t = start + d * 86_400_000;
    const dow = new Date(t).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const s = Math.cos((2 * Math.PI * (dayOfYear(t) - 355)) / 365); // 1 on 21 December
    const daylight = 12 + 2.5 * s;
    const sunrise = 13 - daylight / 2;
    const sunset = 13 + daylight / 2;
    const cloud = cloudChoices[Math.floor(rand() * cloudChoices.length)]!;
    const heating = 1 + 0.35 * Math.max(0, -s);
    for (let ix = 0; ix < 48; ix++) {
      const h = (ix + 0.5) / 2;
      const load =
        (0.18 + 0.45 * Math.exp(-((h - (weekend ? 8 : 7.25)) ** 2) / 1.5) + 0.75 * Math.exp(-((h - 19) ** 2) / 3) + (weekend ? 0.15 * Math.exp(-((h - 13) ** 2) / 8) : 0)) * heating * between(0.85, 1.15);
      const gen = bSize.map((size) => {
        if (h <= sunrise || h >= sunset) return 0;
        return size * (0.75 + 0.25 * s) * cloud * Math.sin((Math.PI * (h - sunrise)) / (sunset - sunrise)) ** 1.5 * between(0.9, 1.05);
      });
      const totalGen = gen.reduce((a, b) => a + b, 0);
      const controlled = eSize.slice(1).map((size) => (h >= 23 || h < 7 ? size * between(0.7, 1.1) : 0));
      e[0]!.push(Math.max(0, load - totalGen));
      controlled.forEach((v, i) => e[i + 1]!.push(v));
      const exported = Math.max(0, totalGen - (eCount > 0 ? load : 0));
      gen.forEach((g, i) => bExport[i]!.push(totalGen > 0 ? (exported * g) / totalGen : 0));
    }
  }

  // Scale each group (E, then B) to its target in whole Wh, then spread each half hour over the intervals.
  const group = (regs: number[][], target: number | undefined): number[][] => {
    const flat = regs.flat();
    const wh = toWh(flat, target);
    return regs.map((_, i) => wh.slice(i * days * 48, (i + 1) * days * 48));
  };
  const split = 30 / per;
  const toStream = (suffix: string, wh: number[]): Nem12Stream => ({
    suffix,
    days: dates.map((date, d) => {
      const values: number[] = [];
      for (let k = 0; k < 48; k++) {
        const half = wh[d * 48 + k]!;
        const each = Math.floor(half / split);
        for (let j = 0; j < split - 1; j++) values.push(each / 1000);
        values.push((half - each * (split - 1)) / 1000);
      }
      return { date, values };
    }),
  });
  const streams: Nem12Stream[] = [];
  if (bCount) group(bExport, o.feedinKwh).forEach((wh, i) => streams.push(toStream(`B${i + 1}`, wh)));
  group(e, o.consumptionKwh).forEach((wh, i) => streams.push(toStream(`E${i + 1}`, wh)));

  const config = streams.map((st) => st.suffix).sort().join("");
  const lines: string[] = [];
  const updated = `${dates[dates.length - 1]}120000`;
  if (o.envelope !== false) lines.push(`100,NEM12,${updated.slice(0, 12)},ACTIVMDP,ENGYAVIC`);
  let index = o.openingIndex ?? 1000;
  const nextRead = ccyymmdd(start + days * 86_400_000);
  streams.forEach((st, i) => {
    lines.push(`200,${nmi},${config},${st.suffix},${st.suffix},N,SERIAL${pad(i + 1)},KWH,${per},${nextRead}`);
    let total = 0;
    for (const d of st.days) {
      lines.push(`300,${d.date},${d.values.map((v) => v.toFixed(3)).join(",")},A,,,${d.date}120000,`);
      total += d.values.reduce((a, b) => a + Math.round(b * 1000), 0) / 1000;
    }
    index += total;
    lines.push(`500,O,,${nextRead}000000,${index.toFixed(3)}`);
  });
  if (o.envelope !== false) lines.push("900");
  return { text: lines.join("\n"), nmi, intervalMinutes: per, dates, streams };
}

/** The NEM12 text alone. */
export const generateNem12 = (o: Nem12Options): string => generateNem12Data(o).text;
