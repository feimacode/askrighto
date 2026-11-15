/**
 * Data rights register: why Ask Righto may reuse each dataset, with the evidence. The human
 * register is docs/data-rights.md; this is the machine copy the server reads. In production a
 * dataset whose status is not servable is never served (see registerTools).
 */
import rightsJson from "./rights.json" with { type: "json" };

export const BASES = ["open_licence", "cdr_rule", "written_permission", "own_words_facts"] as const;
export const STATUSES = ["cleared", "cleared_pending_legal_view", "pending", "refused", "withdrawn"] as const;
export type Basis = (typeof BASES)[number];
export type RightsStatus = (typeof STATUSES)[number];

export interface Evidence {
  url: string;
  /** ISO date a person read the terms. */
  readOn: string;
  note?: string;
}

export interface RightsEntry {
  datasetId: string;
  owner: string;
  basis: Basis;
  status: RightsStatus;
  evidence: Evidence[];
  attribution: string | null;
  conditions: string[];
  /** ISO date by which the entry must be re-read. */
  reviewBy: string;
  /** Repo-relative glob prefixes (`*` at the end) for data files that must not be committed unless the dataset is servable. */
  dataGlobs?: string[];
  /** Source domains this entry governs (used to block course facts sourced from them). */
  domains?: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Throws a readable error if the register is malformed. */
export function parseRights(raw: unknown): RightsEntry[] {
  if (!Array.isArray(raw)) throw new Error("rights register must be a list");
  const seen = new Set<string>();
  return raw.map((r, i) => {
    const e = r as RightsEntry;
    const fail = (why: string): never => {
      throw new Error(`rights entry ${i} (${e?.datasetId ?? "?"}): ${why}`);
    };
    if (!e || typeof e.datasetId !== "string" || !e.datasetId) fail("datasetId is required");
    if (seen.has(e.datasetId)) fail("duplicate datasetId");
    seen.add(e.datasetId);
    if (!e.owner) fail("owner is required");
    if (!(BASES as readonly string[]).includes(e.basis)) fail(`unknown basis "${e.basis}"`);
    if (!(STATUSES as readonly string[]).includes(e.status)) fail(`unknown status "${e.status}"`);
    if (!Array.isArray(e.evidence) || e.evidence.length === 0) fail("at least one piece of evidence is required");
    for (const ev of e.evidence) {
      if (!ev.url || !/^https?:\/\//.test(ev.url)) fail("evidence needs a URL");
      if (!ISO_DATE.test(ev.readOn ?? "")) fail("evidence needs a readOn date (YYYY-MM-DD)");
    }
    if (!ISO_DATE.test(e.reviewBy ?? "")) fail("reviewBy date (YYYY-MM-DD) is required");
    if (!Array.isArray(e.conditions)) fail("conditions must be a list");
    return e;
  });
}

export const RIGHTS: readonly RightsEntry[] = parseRights(rightsJson);

const byId = new Map(RIGHTS.map((e) => [e.datasetId, e]));

export function rightsFor(datasetId: string): RightsEntry | undefined {
  return byId.get(datasetId);
}

export const SERVABLE: readonly RightsStatus[] = ["cleared", "cleared_pending_legal_view"];

export function isServableStatus(s: RightsStatus): boolean {
  return (SERVABLE as readonly string[]).includes(s);
}

/** Production rules apply when ASKRIGHTO_ENV=production, or NODE_ENV=production with no ASKRIGHTO_ENV. */
export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ASKRIGHTO_ENV) return env.ASKRIGHTO_ENV === "production";
  return env.NODE_ENV === "production";
}

export type Availability = { servable: true; warning?: string } | { servable: false; reason: string };

/** Whether tools may serve a dataset's data right now. Development serves it with a warning. */
export function availability(datasetId: string, env: NodeJS.ProcessEnv = process.env): Availability {
  const e = rightsFor(datasetId);
  const ok = e ? isServableStatus(e.status) : false;
  if (ok) return { servable: true };
  const why = e ? `its reuse status is "${e.status}"` : "it has no entry in the data rights register";
  if (isProduction(env)) return { servable: false, reason: why };
  return { servable: true, warning: `Source "${datasetId}" is not cleared for production (${why}); shown for development only.` };
}

/** Throws if a dataset about to be registered has no rights entry (production only). */
export function assertRegistrable(datasetId: string, env: NodeJS.ProcessEnv = process.env): void {
  if (rightsFor(datasetId)) return;
  if (isProduction(env)) throw new Error(`Dataset "${datasetId}" has no entry in the data rights register (src/core/rights.json); refusing to start in production.`);
  console.error(`warning: dataset "${datasetId}" has no data rights entry`);
}

/** Entries whose review-by date has passed. */
export function overdueReviews(now: Date = new Date()): RightsEntry[] {
  const today = now.toISOString().slice(0, 10);
  return RIGHTS.filter((e) => e.reviewBy < today);
}

/** Attribution text for the given datasets, de-duplicated. */
export function attributionFor(ids: readonly string[]): string | undefined {
  const out = [...new Set(ids.map((id) => rightsFor(id)?.attribution).filter((a): a is string => !!a))];
  return out.length ? out.join(" ") : undefined;
}
