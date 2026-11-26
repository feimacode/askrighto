/**
 * Read-only report that proposes CRICOS codes for the pilot stand-in rows (gap_fill courses with no
 * cricosCode). It never links anything: a person checks the campus and year and sets `cricosCode` on the
 * stand-in in the YAML (extend-courses-to-uac-qtac, decision 6).
 */
import type { CricosCourse } from "./cricos.js";
import type { ProviderFile } from "./types.js";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const bare = (s: string) => norm(s.replace(/\([^)]*\)/g, " "));

export interface StandinMatch {
  courseId: string;
  providerId: string;
  name: string;
  /** `unique`: one CRICOS course has the same name; `ambiguous`: several; `loose`: same name once brackets are ignored; `none`. */
  status: "unique" | "ambiguous" | "loose" | "none";
  candidates: { cricosCode: string; name: string; locations: string[] }[];
}

export function matchStandins(
  files: readonly ProviderFile[],
  cricos: readonly CricosCourse[],
): StandinMatch[] {
  const out: StandinMatch[] = [];
  for (const f of files) {
    const code = f.provider.cricosProviderCode;
    const pool = cricos.filter((c) => !!code && c.providerCode === code);
    for (const c of f.courses) {
      if (c.origin !== "gap_fill" || c.cricosCode) continue;
      const exact = pool.filter((x) => norm(x.courseName) === norm(c.name));
      const loose = exact.length
        ? []
        : pool.filter((x) => bare(x.courseName) === bare(c.name));
      const hits = exact.length ? exact : loose;
      out.push({
        courseId: c.id,
        providerId: f.provider.id,
        name: c.name,
        status: !hits.length
          ? "none"
          : exact.length
            ? exact.length === 1
              ? "unique"
              : "ambiguous"
            : "loose",
        candidates: hits.map((x) => ({
          cricosCode: x.cricosCode,
          name: x.courseName,
          locations: x.locations,
        })),
      });
    }
  }
  return out;
}

export function standinSummary(m: readonly StandinMatch[]) {
  const by = (s: StandinMatch["status"]) => m.filter((x) => x.status === s).length;
  return {
    standins: m.length,
    unique: by("unique"),
    ambiguous: by("ambiguous"),
    loose: by("loose"),
    none: by("none"),
  };
}
