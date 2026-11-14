/**
 * Registry of the datasets the server holds. Data modules register themselves;
 * `list_data_sources` reads it and tools use it to flag stale data.
 */
import type { Source } from "./grounded.js";

export interface DataSet {
  id: string;
  title: string;
  publisher: string;
  source: Source;
  /** What the dataset covers, in words, e.g. "Residential electricity and gas plans, NSW, QLD, SA, TAS, VIC, ACT". */
  coverage: string;
  /** Last successful refresh, or undefined if never loaded. */
  refreshedAt(): Date | undefined;
  /** Results older than this carry a staleness warning. */
  maxAgeHours: number;
  /** Extra facts shown in the listing (counts, failing retailers). */
  stats?(): Record<string, unknown>;
}

const datasets = new Map<string, DataSet>();

export function registerDataSet(d: DataSet): void {
  if (datasets.has(d.id)) throw new Error(`Dataset ${d.id} is already registered`);
  datasets.set(d.id, d);
}

export function listDataSets(): DataSet[] {
  return [...datasets.values()];
}

export function getDataSet(id: string): DataSet | undefined {
  return datasets.get(id);
}

/** For tests only. */
export function clearDataSets(): void {
  datasets.clear();
}

/** Staleness warnings for the datasets a result was built from. */
export function staleWarnings(ids: readonly string[], now: Date = new Date()): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const d = datasets.get(id);
    if (!d) continue;
    const at = d.refreshedAt();
    if (!at) {
      out.push(`${d.title} has not been loaded yet.`);
    } else if (now.getTime() - at.getTime() > d.maxAgeHours * 3_600_000) {
      out.push(`${d.title} was last refreshed on ${at.toISOString()}, which is older than expected, so it may be out of date.`);
    }
  }
  return out;
}

/** The oldest refresh time among the given datasets, used as a result's as-of date. */
export function oldestRefresh(ids: readonly string[]): Date | undefined {
  let oldest: Date | undefined;
  for (const id of ids) {
    const at = datasets.get(id)?.refreshedAt();
    if (!at) return undefined;
    if (!oldest || at < oldest) oldest = at;
  }
  return oldest;
}
