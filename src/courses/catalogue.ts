/** The loaded CRICOS course index in memory, plus the search helpers the tools use. */
import type { AdmissionsState } from "./sources.js";
import type { Course, Provider } from "./types.js";

export interface Catalogue {
  providers: Provider[];
  courses: Course[];
  loadedAt: Date;
}

export interface CatalogueSource {
  catalogue(): Promise<Catalogue>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function findCourse(cat: Catalogue, id: string): Course | undefined {
  return cat.courses.find((c) => c.id === id);
}

const REGION_STATES: Record<string, AdmissionsState[]> = { vic: ["vic"], "nsw-act": ["nsw"], qld: ["qld"] };

/** The states whose admissions system applies to a provider: its `states`, or the default for its region. */
export function admissionsStatesOf(p: Provider | undefined): AdmissionsState[] {
  if (!p) return [];
  return p.states?.length ? p.states : (REGION_STATES[p.region ?? "vic"] ?? []);
}

export function providerOf(cat: Catalogue, c: Course): Provider | undefined {
  return cat.providers.find((p) => p.id === c.providerId);
}

export interface SearchFilter {
  query?: string;
  university?: string;
  campus?: string;
  /** `vic`, `nsw-act` or `qld`: the region of the provider. */
  region?: string;
}

/** Matches a university by id, name or a distinctive word of its name ("monash", "RMIT"). */
export function matchProvider(cat: Catalogue, q: string): Provider[] {
  const n = norm(q);
  if (!n) return [];
  const exact = cat.providers.filter((p) => p.id === n || norm(p.name) === n);
  if (exact.length) return exact;
  return cat.providers.filter(
    (p) =>
      norm(p.name).includes(n) ||
      n.split(" ").every((w) => norm(p.name).split(" ").includes(w)),
  );
}

export function filterCourses(cat: Catalogue, f: SearchFilter): Course[] {
  const words = (f.query ? norm(f.query) : "").split(" ").filter(Boolean);
  const unis = f.university
    ? new Set(matchProvider(cat, f.university).map((p) => p.id))
    : undefined;
  const campus = f.campus ? norm(f.campus) : "";
  const regionOf = (id: string) =>
    cat.providers.find((p) => p.id === id)?.region ?? "vic";
  return cat.courses.filter((c) => {
    if (f.region && regionOf(c.providerId) !== f.region) return false;
    if (unis && !unis.has(c.providerId)) return false;
    if (campus && !c.campuses.some((x) => norm(x).includes(campus)))
      return false;
    if (words.length) {
      const hay = norm(c.name);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
