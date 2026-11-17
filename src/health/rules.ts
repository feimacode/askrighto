/**
 * Dated rules for health cover calculations (add-health-cover-rates). Read from data/health/rates.yaml.
 * A row with status `proposed` is never used for a number; it can only be mentioned.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { dataDir } from "../courses/studies.js";

export type RuleStatus = "in_force" | "legislated_future" | "proposed";
export interface RuleSource {
  url: string;
  pageUpdatedOn: string;
  readOn: string;
}
interface Base {
  id: string;
  status: RuleStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  source: RuleSource;
  reviewBy: string;
  note?: string;
}
export interface Thresholds {
  single: [number, number, number];
  family: [number, number, number];
}
export interface RebateRule extends Base {
  thresholds: Thresholds;
  childIncrement: number;
  percents: Record<"under65" | "age65to69" | "age70plus", number[]>;
}
export interface MlsRule extends Base {
  thresholds: Thresholds;
  childIncrement: number;
  ratePercents: number[];
}
export interface LhcRule extends Base {
  percentPerYearOver: number;
  startAge: number;
  capPercent: number;
  yearsToRemove: number;
}
export interface RatesData {
  rebate: RebateRule[];
  mls: MlsRule[];
  lhc: LhcRule[];
  /** Newest page-updated date among the rows used; shown as the rules' as-of date. */
  loadedFrom: string;
}

export const AGE_BANDS = ["under65", "age65to69", "age70plus"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const TIER_CODES = ["base", "tier1", "tier2", "tier3"] as const;
export type TierCode = (typeof TIER_CODES)[number];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["in_force", "legislated_future", "proposed"];

/** Throws a readable error for a malformed rule set. */
export function validateRates(raw: unknown): RatesData {
  const r = raw as Partial<RatesData>;
  const fail = (m: string): never => {
    throw new Error(`rates: ${m}`);
  };
  if (!r || typeof r !== "object") fail("not an object");
  const families = { rebate: r.rebate, mls: r.mls, lhc: r.lhc } as const;
  for (const [fam, rows] of Object.entries(families)) {
    if (!Array.isArray(rows) || rows.length === 0) fail(`${fam} has no rows`);
    for (const row of rows as Base[]) {
      const id = `${fam}/${row.id ?? "?"}`;
      if (!row.id) fail(`${fam} row without an id`);
      if (!STATUSES.includes(row.status)) fail(`${id}: unknown status`);
      if (!ISO.test(String(row.effectiveFrom))) fail(`${id}: effectiveFrom must be YYYY-MM-DD`);
      if (row.effectiveTo !== undefined && !ISO.test(String(row.effectiveTo)))
        fail(`${id}: effectiveTo must be YYYY-MM-DD`);
      if (!row.source?.url || !ISO.test(String(row.source.readOn)) || !ISO.test(String(row.source.pageUpdatedOn)))
        fail(`${id}: needs a source url, pageUpdatedOn and readOn`);
      if (!ISO.test(String(row.reviewBy))) fail(`${id}: reviewBy must be YYYY-MM-DD`);
    }
    // No two rows of one family and status may overlap in date.
    const used = (rows as Base[]).filter((x) => x.status !== "proposed");
    for (const a of used)
      for (const b of used)
        if (a !== b) {
          const aEnd = a.effectiveTo ?? "9999-12-31";
          const bEnd = b.effectiveTo ?? "9999-12-31";
          if (a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd)
            fail(`${fam}: ${a.id} and ${b.id} overlap`);
        }
  }
  const latest = [...r.rebate!, ...r.mls!, ...r.lhc!]
    .map((x) => x.source.pageUpdatedOn)
    .sort()
    .pop()!;
  return { rebate: r.rebate!, mls: r.mls!, lhc: r.lhc!, loadedFrom: latest };
}

/** Reads data/health/rates.yaml. YAML turns bare dates into Date objects, so they are written back to strings. */
export function loadRates(dir = dataDir()): RatesData {
  const text = readFileSync(resolve(dir, "health", "rates.yaml"), "utf8");
  const doc = parse(text, { schema: "core" }) as unknown;
  return validateRates(doc);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

const inRange = (r: Base, date: string) =>
  r.effectiveFrom <= date && date <= (r.effectiveTo ?? "9999-12-31");

/** Rows that may feed a number on `date`: in force or legislated, never proposed. */
export function ruleAt<T extends Base>(rows: T[], date: string): T | undefined {
  return rows.find((r) => r.status !== "proposed" && inRange(r, date));
}
/** A proposed row covering `date`, mentioned but never calculated from. */
export function proposedAt<T extends Base>(rows: T[], date: string): T | undefined {
  return rows.find((r) => r.status === "proposed" && inRange(r, date));
}

/** Rows whose review date has passed. */
export function overdueRules(rates: RatesData, today = todayIso()): string[] {
  return [...rates.rebate, ...rates.mls, ...rates.lhc]
    .filter((r) => r.reviewBy < today)
    .map((r) => `${r.id} (review by ${r.reviewBy})`);
}

export const toMilli = (percent: number) => Math.round(percent * 1000);
