/**
 * Finds the CRICOS dataset's CSV resources on data.gov.au (CKAN API) and downloads them into memory.
 * The fetch function is injected so tests run on fixtures. Only https on data.gov.au is ever contacted.
 */
import { createHash } from "node:crypto";

export const CKAN_PACKAGE_URL =
  "https://data.gov.au/data/api/3/action/package_show?id=cricos";
export const MAX_BODY_BYTES = 40 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; redirect?: "follow" | "manual" | "error" },
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

/** The three resources the loaders need, by their published names. */
export const RESOURCE_NAMES = {
  courses: "CRICOS Courses.csv",
  courseLocations: "CRICOS Course Locations.csv",
  institutions: "CRICOS Institutions.csv",
} as const;
export type ResourceKey = keyof typeof RESOURCE_NAMES;

export interface CricosResource {
  id: string;
  name: string;
  url: string;
  lastModified: string;
}
export interface CricosSource {
  resources: Record<ResourceKey, CricosResource>;
  /** Date part (UTC) of the Courses resource's last_modified: the day the file was published. */
  sourceDate: string;
  /** Resource ids and modified times; equal fingerprints mean nothing changed at data.gov.au. */
  fingerprint: string;
}

export class CricosSourceError extends Error {}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** True for https URLs on data.gov.au or one of its subdomains. */
export function allowedHost(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "data.gov.au" || u.hostname.endsWith(".data.gov.au"))
    );
  } catch {
    return false;
  }
}

async function get(f: FetchLike, url: string): Promise<string> {
  if (!allowedHost(url))
    throw new CricosSourceError(`refusing to fetch ${hostOf(url)}: only https on data.gov.au is allowed`);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await f(url, { signal: ctl.signal });
    if (!allowedHost(res.url || url))
      throw new CricosSourceError(`redirected to ${hostOf(res.url)}: only https on data.gov.au is allowed`);
    if (!res.ok) throw new CricosSourceError(`${hostOf(url)} answered ${res.status}`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BODY_BYTES)
      throw new CricosSourceError(`a resource is ${len} bytes; the limit is ${MAX_BODY_BYTES}`);
    const body = await res.text();
    if (body.length > MAX_BODY_BYTES)
      throw new CricosSourceError(`a resource is larger than ${MAX_BODY_BYTES} bytes`);
    return body;
  } catch (e) {
    if (e instanceof CricosSourceError) throw e;
    throw new CricosSourceError(`could not fetch from ${hostOf(url)}: ${(e as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "an invalid URL";
  }
};

/** Asks CKAN which resources are current. Throws CricosSourceError when anything needed is missing. */
export async function findCricosSource(f: FetchLike): Promise<CricosSource> {
  const body = await get(f, CKAN_PACKAGE_URL);
  let json: { success?: boolean; result?: { resources?: unknown[] } };
  try {
    json = JSON.parse(body);
  } catch {
    throw new CricosSourceError("data.gov.au did not return JSON for the CRICOS dataset");
  }
  const list = (json.result?.resources ?? []) as Record<string, unknown>[];
  if (!json.success || !Array.isArray(list) || list.length === 0)
    throw new CricosSourceError("the CRICOS dataset has no resources");
  const found = {} as Record<ResourceKey, CricosResource>;
  for (const key of Object.keys(RESOURCE_NAMES) as ResourceKey[]) {
    const wanted = norm(RESOURCE_NAMES[key]);
    const r = list.find((x) => norm(String(x.name ?? "")) === wanted);
    if (!r || !r.url || !r.id)
      throw new CricosSourceError(`the CRICOS dataset has no resource named "${RESOURCE_NAMES[key]}"`);
    const url = String(r.url);
    if (!allowedHost(url))
      throw new CricosSourceError(`resource "${RESOURCE_NAMES[key]}" is on ${hostOf(url)}, not data.gov.au`);
    const lastModified = String(r.last_modified ?? r.metadata_modified ?? "");
    if (!/^\d{4}-\d{2}-\d{2}/.test(lastModified))
      throw new CricosSourceError(`resource "${RESOURCE_NAMES[key]}" has no modified date`);
    found[key] = { id: String(r.id), name: String(r.name), url, lastModified };
  }
  const fingerprint = (Object.keys(found) as ResourceKey[])
    .map((k) => `${k}:${found[k].id}@${found[k].lastModified}`)
    .join("|");
  return {
    resources: found,
    sourceDate: found.courses.lastModified.slice(0, 10),
    fingerprint,
  };
}

export interface CricosFiles {
  courses: string;
  courseLocations: string;
  institutions: string;
  /** SHA-256 over the three bodies, so identical content can be recognised after a metadata-only change. */
  contentHash: string;
}

export async function downloadCricos(
  f: FetchLike,
  src: CricosSource,
): Promise<CricosFiles> {
  const courses = await get(f, src.resources.courses.url);
  const courseLocations = await get(f, src.resources.courseLocations.url);
  const institutions = await get(f, src.resources.institutions.url);
  const contentHash = createHash("sha256")
    .update(courses)
    .update("\0")
    .update(courseLocations)
    .update("\0")
    .update(institutions)
    .digest("hex");
  return { courses, courseLocations, institutions, contentHash };
}
