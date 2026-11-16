/**
 * The VCE aggregate counting rule, ported from the earlier pilot (atar-aggregate.ts) as a pure function.
 * Primary four: the highest English-group scaled score plus the next three highest, with at most two
 * from the same study area grouping. Increments: 10% of up to two more, with at most three from the same
 * grouping overall. An aggregate is not an ATAR: the ATAR ranks it against the whole state cohort.
 */
import type { Groupings, ScalingTable } from "./types.js";

export interface ScoredStudy {
  studyId: string;
  name: string;
  /** The expected raw study score, 0 to 50. */
  raw: number;
}
export type Role = "primary" | "increment" | "not_counted";
export interface Counted {
  studyId: string;
  name: string;
  raw: number;
  scaled: number;
  interpolated: boolean;
  role: Role;
  contribution: number;
  reason: string;
}
export type AggregateResult =
  | { computed: false; reason: string; studies: Counted[] }
  | { computed: true; aggregate: number; studies: Counted[] };

/** Scaled score at a raw score: exact at a published point, linear between points, undefined outside the range. */
export function scaledAt(
  points: ReadonlyArray<readonly [number, number]>,
  raw: number,
): { scaled: number; interpolated: boolean } | undefined {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last || raw < first[0] || raw > last[0]) return undefined;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    if (x === raw) return { scaled: y, interpolated: false };
    const next = pts[i + 1];
    if (next && raw > x && raw < next[0]) {
      const t = (raw - x) / (next[0] - x);
      return {
        scaled: Math.round((y + t * (next[1] - y)) * 100) / 100,
        interpolated: true,
      };
    }
  }
  return undefined;
}

export function scaledFor(table: ScalingTable, studyId: string, raw: number) {
  const s = table.studies.find((x) => x.studyId === studyId);
  return s ? scaledAt(s.points, raw) : undefined;
}

export function computeAggregate(
  studies: readonly ScoredStudy[],
  table: ScalingTable,
  groupings: Groupings,
): AggregateResult {
  const rows: Counted[] = [];
  const unscaled: string[] = [];
  for (const s of studies) {
    const sc = scaledFor(table, s.studyId, s.raw);
    if (!sc) {
      unscaled.push(s.name);
      rows.push({
        ...s,
        scaled: 0,
        interpolated: false,
        role: "not_counted",
        contribution: 0,
        reason:
          "No published scaling for this study at this score, so it cannot be counted.",
      });
    } else
      rows.push({
        ...s,
        scaled: sc.scaled,
        interpolated: sc.interpolated,
        role: "not_counted",
        contribution: 0,
        reason: "",
      });
  }
  if (unscaled.length)
    return {
      computed: false,
      reason: `No published scaling at the score given for: ${unscaled.join(", ")}.`,
      studies: rows,
    };
  const scoredRows = rows;
  const group = (r: Counted) => groupings.groupOf[r.studyId] ?? null;
  const english = scoredRows
    .filter((r) => group(r) === groupings.englishGroup)
    .sort((a, b) => b.scaled - a.scaled);
  if (scoredRows.length < 4)
    return {
      computed: false,
      reason: "At least four studies are needed.",
      studies: rows,
    };
  if (english.length === 0)
    return {
      computed: false,
      reason:
        "One English-group study (English, EAL, Literature or English Language) is needed.",
      studies: rows,
    };

  const counts = new Map<string, number>();
  const bump = (r: Counted) => {
    const g = group(r);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  };
  const primary: Counted[] = [english[0]!];
  english[0]!.role = "primary";
  english[0]!.contribution = english[0]!.scaled;
  english[0]!.reason =
    "Highest English-group score, always counted in the primary four.";
  bump(english[0]!);
  const rest = scoredRows
    .filter((r) => r !== english[0])
    .sort((a, b) => b.scaled - a.scaled);
  const deferred: Counted[] = [];
  for (const r of rest) {
    const g = group(r);
    if (primary.length >= 4) deferred.push(r);
    else if (g && (counts.get(g) ?? 0) >= 2) {
      r.reason = `Already two studies from the same study area grouping (${g}) in the primary four.`;
      deferred.push(r);
    } else {
      r.role = "primary";
      r.contribution = r.scaled;
      r.reason = "One of the four highest permissible scaled scores.";
      primary.push(r);
      bump(r);
    }
  }
  let inc = 0;
  for (const r of deferred) {
    const g = group(r);
    if (inc >= 2) {
      r.reason = "Not among the primary four or the two highest increments.";
      continue;
    }
    if (g && (counts.get(g) ?? 0) >= 3) {
      r.reason = `Three studies from the same study area grouping (${g}) already count, which is the most.`;
      continue;
    }
    r.role = "increment";
    r.contribution = r.scaled / 10;
    r.reason = "Counted at 10% as one of the two increments.";
    inc++;
    bump(r);
  }
  const total = rows.reduce((n, r) => n + r.contribution, 0);
  return {
    computed: true,
    aggregate: Math.round(total * 10) / 10,
    studies: rows,
  };
}
