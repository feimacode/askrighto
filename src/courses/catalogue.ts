/** The loaded course set in memory, plus the search helpers the tools use. */
import type { Course, Provider } from "./types.js";

export interface Catalogue {
  providers: Provider[];
  courses: Course[];
  loadedAt: Date;
  gitSha?: string;
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

export function providerOf(cat: Catalogue, c: Course): Provider | undefined {
  return cat.providers.find((p) => p.id === c.providerId);
}

export interface SearchFilter {
  query?: string;
  field?: string;
  university?: string;
  campus?: string;
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
  const q = f.query ? norm(f.query) : "";
  const words = q.split(" ").filter(Boolean);
  const unis = f.university
    ? new Set(matchProvider(cat, f.university).map((p) => p.id))
    : undefined;
  const field = f.field ? norm(f.field) : "";
  const campus = f.campus ? norm(f.campus) : "";
  return cat.courses.filter((c) => {
    if (unis && !unis.has(c.providerId)) return false;
    if (
      field &&
      !c.fields.some(
        (x) =>
          norm(x) === field ||
          norm(x).includes(field) ||
          field.includes(norm(x)),
      )
    )
      return false;
    if (campus && !c.campuses.some((x) => norm(x).includes(campus)))
      return false;
    if (words.length) {
      const hay = norm(`${c.name} ${c.fields.join(" ")} ${c.summary ?? ""}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

export function allFields(cat: Catalogue): string[] {
  return [...new Set(cat.courses.flatMap((c) => c.fields))].sort();
}
