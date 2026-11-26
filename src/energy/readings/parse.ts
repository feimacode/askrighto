/**
 * Reads the text of a NEM12 interval meter data file (AEMO Meter Data File Format Specification NEM12 & NEM13,
 * v2.7) in memory. Nothing is stored. The NMI and meter serial are looked at only to count NMIs and never
 * leave this function; errors name a line number and a problem, never line content.
 *
 * Tolerant of what real distributor exports do: no 100 header or 900 end record, a missing trailing field,
 * blank reason fields, V (variable) days with 400 event records, several 200 blocks, 5/15/30 minute intervals.
 * Strict about what would make figures wrong: not NEM12, more than one NMI, units other than kWh/Wh/MWh on a stream
 * we use, non-numeric values, short interval lines, duplicate dates.
 *
 * Stream suffixes (AEMO National Metering Identifier Procedure, Table 1, named from the grid's side): first
 * character E (master "export" kWh) is energy delivered to the household, so main consumption; B (master "import")
 * is energy the household puts into the grid, so solar export. Averaged (D, A) and check (F, C) variants are used only
 * when no master stream of that kind exists. N (net, E minus B) is used only when neither is present. Controlled load
 * is not identified from the suffix: every E stream is main consumption.
 */

/**
 * The longest text read. Our HTTP body limit is 2 MB (2,097,152 bytes, ASKRIGHTO_BODY_LIMIT), so this sits just under
 * it: a longer paste is refused here with a plain message, not as a transport error. 2,000,000 characters holds a year
 * of 5-minute data (628 to 730 KB measured) even with a solar export stream. The limit was 250,000 until 20 Nov 2026;
 * Iven asked to ease it so that a long file is not cut down before it is read. What a host can actually write out in
 * one tool call is lower than this and is the practical limit.
 */
export const MAX_READINGS_CHARS = 2_000_000;

export type ParseProblem = { ok: false; problem: string; line?: number };

export interface ParsedReadings {
  ok: true;
  /** Date (CCYYMMDD) to 48 half-hour kWh values, market time (AEST). Streams of the same kind are summed. */
  consumption: Map<string, number[]>;
  /** Solar export (B streams), same shape; empty when none. */
  exportKwh: Map<string, number[]>;
  /** True when only a net (N) stream was present: consumption is net of the household's own solar. */
  netOnly: boolean;
  streamsUsed: { consumption: string[]; export: string[] };
  /** Days with a non-A quality flag that are not V days. */
  nonActualDays: number;
  /** Intervals in 400 records with reason code 79 (power outage). */
  outageIntervals: number;
  variableDays: number;
  ignoredStreams: string[];
}

const UOM: Record<string, number> = { KWH: 1, WH: 0.001, MWH: 1000 };
const INTERVALS = new Set([5, 15, 30]);
const DATE = /^\d{8}$/;

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

type Block = { suffix: string; factor: number; per: number; n: number; use: boolean };

/** `maxChars` is raised only by the upload route, which takes the file by address instead of through a tool call. */
export function parseNem12(text: string, maxChars: number = MAX_READINGS_CHARS): ParsedReadings | ParseProblem {
  if (text.length > maxChars)
    return {
      ok: false,
      problem: `the text is ${text.length.toLocaleString("en-AU")} characters, over the limit of ${maxChars.toLocaleString("en-AU")} (a year of 30-minute data with solar export is about 230,000 characters). Send a shorter period, for example the last 12 months, or ask the distributor or retailer for 30-minute intervals`,
    };
  const lines = text.split(/\r?\n/);
  const nmis = new Set<string>();
  const streams = new Map<string, Map<string, number[]>>(); // suffix -> date -> 48 values
  const ignored = new Set<string>();
  let block: Block | undefined;
  let saw200 = false;
  let nonActualDays = 0;
  let variableDays = 0;
  let outageIntervals = 0;
  let lastWas300V = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim() === "") continue;
    const f = raw.split(",");
    const kind = f[0]!.trim();
    const ln = i + 1;
    switch (kind) {
      case "100":
      case "500":
      case "900":
        break;
      case "250":
      case "350":
      case "550":
        return { ok: false, problem: "this is an accumulation (meter reading, NEM13) file with no half-hourly figures; ask for interval data (NEM12)", line: ln };
      case "200": {
        saw200 = true;
        if (f.length < 9) return { ok: false, problem: "a 200 record has too few fields", line: ln };
        const nmi = f[1]!.trim();
        if (!nmi) return { ok: false, problem: "a 200 record has no NMI", line: ln };
        nmis.add(nmi);
        if (nmis.size > 1) return { ok: false, problem: "the file holds more than one NMI; send one household's file", line: ln };
        const suffix = f[4]!.trim().toUpperCase();
        const uom = f[7]!.trim().toUpperCase();
        const per = Number(f[8]!.trim());
        const first = suffix[0] ?? "";
        const wanted = "ABCDEFN".includes(first);
        if (!suffix) return { ok: false, problem: "a 200 record has no data stream suffix", line: ln };
        if (wanted && !(uom in UOM)) return { ok: false, problem: `a ${suffix} stream is in an unsupported unit (kWh, Wh or MWh expected)`, line: ln };
        if (wanted && !INTERVALS.has(per)) return { ok: false, problem: `a ${suffix} stream has an unsupported interval length (5, 15 or 30 minutes expected)`, line: ln };
        block = { suffix, factor: UOM[uom] ?? 1, per, n: Math.floor(1440 / (per || 30)), use: wanted };
        if (!wanted) ignored.add(suffix);
        lastWas300V = false;
        break;
      }
      case "300": {
        if (!block) return { ok: false, problem: "an interval record (300) comes before any 200 record", line: ln };
        lastWas300V = false;
        if (!block.use) break;
        const date = (f[1] ?? "").trim();
        if (!validDate(date)) return { ok: false, problem: "an interval record has no valid date", line: ln };
        if (f.length < 2 + block.n) return { ok: false, problem: `an interval record has fewer than the ${block.n} values it needs`, line: ln };
        const vals: number[] = [];
        for (let k = 0; k < block.n; k++) {
          const s = f[2 + k]!.trim();
          const x = s === "" ? NaN : Number(s);
          if (!Number.isFinite(x)) return { ok: false, problem: `an interval value is not a number (value ${k + 1})`, line: ln };
          if (x < 0 && block.suffix[0] !== "N") return { ok: false, problem: `an interval value is negative (value ${k + 1})`, line: ln };
          vals.push(x * block.factor);
        }
        const step = 30 / block.per;
        const half: number[] = [];
        for (let k = 0; k < 48; k++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += vals[k * step + j]!;
          half.push(sum);
        }
        let byDate = streams.get(block.suffix);
        if (!byDate) streams.set(block.suffix, (byDate = new Map()));
        if (byDate.has(date)) return { ok: false, problem: "two interval records have the same date for one stream", line: ln };
        byDate.set(date, half);
        const q = (f[2 + block.n] ?? "").trim().toUpperCase().slice(0, 1); // quality flag; any method digits follow it
        if (q === "V") {
          variableDays++;
          lastWas300V = true;
        } else if (q && q !== "A") nonActualDays++;
        break;
      }
      case "400": {
        if (!lastWas300V || !block?.use) break;
        const a = Number(f[1]), b = Number(f[2]);
        const reason = (f[4] ?? "").trim();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a && reason === "79") outageIntervals += b - a + 1;
        break;
      }
      default:
        return { ok: false, problem: `an unknown record type was found (${kind.slice(0, 6) || "empty"}); this does not look like a NEM12 file`, line: ln };
    }
  }
  if (!saw200) return { ok: false, problem: "no 200 record was found; this does not look like a NEM12 file" };

  const pick = (firsts: string[]) => {
    for (const ch of firsts) {
      const names = [...streams.keys()].filter((s) => s[0] === ch).sort();
      if (names.length) return names;
    }
    return [] as string[];
  };
  // Consumption: E master, else D average, else F check. Export: B master, else A average, else C check.
  let cons = pick(["E", "D", "F"]);
  const exp = pick(["B", "A", "C"]);
  let netOnly = false;
  if (cons.length === 0 && exp.length === 0) {
    cons = pick(["N"]);
    netOnly = cons.length > 0;
  }
  if (cons.length === 0) return { ok: false, problem: "the file has no consumption stream (no E stream, and no net N stream)" };

  const sumStreams = (names: string[]) => {
    const out = new Map<string, number[]>();
    for (const n of names)
      for (const [d, v] of streams.get(n)!) {
        const cur = out.get(d);
        if (!cur) out.set(d, v.slice());
        else for (let k = 0; k < 48; k++) cur[k]! += v[k]!;
      }
    return out;
  };
  return {
    ok: true,
    consumption: sumStreams(cons),
    exportKwh: sumStreams(exp),
    netOnly,
    streamsUsed: { consumption: cons, export: exp },
    nonActualDays,
    outageIntervals,
    variableDays,
    ignoredStreams: [...ignored].sort(),
  };
}
