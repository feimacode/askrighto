import { readFileSync } from "node:fs";
import type { FetchLike } from "../../src/cricos/source.js";

const DIR = "test/fixtures/cricos/real-layout";
export const fixtureCsv = (f: string) => readFileSync(`${DIR}/${f}`, "utf8");

export interface FakeDataset {
  modified?: string;
  courses?: string;
  courseLocations?: string;
  institutions?: string;
  /** Replace a resource URL (to test a foreign host). */
  urlFor?: Partial<Record<"courses" | "courseLocations" | "institutions", string>>;
  omit?: "courses" | "courseLocations" | "institutions";
  /** Serve a resource from another host after a redirect. */
  redirectTo?: string;
}

const NAMES = {
  courses: "CRICOS Courses.csv",
  courseLocations: "CRICOS Course Locations.csv",
  institutions: "CRICOS Institutions.csv",
} as const;

/** A fake fetch that answers the CKAN call and the three downloads from fixtures. Records the URLs asked for. */
export function fakeFetch(d: FakeDataset = {}): FetchLike & { calls: string[] } {
  const modified = d.modified ?? "2026-11-02T08:03:13.668";
  const bodies = {
    courses: d.courses ?? fixtureCsv("courses.csv"),
    courseLocations: d.courseLocations ?? fixtureCsv("course-locations.csv"),
    institutions: d.institutions ?? fixtureCsv("institutions.csv"),
  };
  const url = (k: keyof typeof NAMES) =>
    d.urlFor?.[k] ?? `https://data.gov.au/data/dataset/x/resource/${k}/download/${k}.csv`;
  const calls: string[] = [];
  const f: FetchLike = async (u) => {
    calls.push(u);
    const headers = { get: () => null };
    if (u.includes("package_show"))
      return {
        ok: true,
        status: 200,
        url: u,
        headers,
        text: async () =>
          JSON.stringify({
            success: true,
            result: {
              resources: (Object.keys(NAMES) as (keyof typeof NAMES)[])
                .filter((k) => k !== d.omit)
                .map((k) => ({
                  id: `id-${k}`,
                  name: NAMES[k],
                  url: url(k),
                  last_modified: modified,
                })),
            },
          }),
      };
    const k = (Object.keys(NAMES) as (keyof typeof NAMES)[]).find((x) => u === url(x));
    if (!k) return { ok: false, status: 404, url: u, headers, text: async () => "" };
    return {
      ok: true,
      status: 200,
      url: d.redirectTo ?? u,
      headers,
      text: async () => bodies[k],
    };
  };
  return Object.assign(f, { calls });
}
