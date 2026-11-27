/**
 * Courses vertical runtime: database access, dataset registration and readiness. With no DATABASE_URL the
 * module stays off and course tools report the data as unavailable. Only one query path (a cached snapshot)
 * touches the database, and it runs under a statement timeout.
 */
import { notFound, type Grounded } from "../core/grounded.js";
import { addReadinessCheck } from "../core/readiness.js";
import { registerDataSet } from "../core/registry.js";
import { createDb, dbConfig, schemaCurrent } from "../energy/db.js";
import type { Catalogue, CatalogueSource } from "./catalogue.js";
import { CourseStore, NoCourseLoad } from "./load.js";

export const COURSES_REQUIRED_SCHEMA = 11;
const STATEMENT_TIMEOUT_MS = 2000;

export interface CoursesRuntime {
  courses: CatalogueSource;
  stop(): Promise<void>;
}

let runtime: CoursesRuntime | undefined;
export function getCourses(): CoursesRuntime | undefined {
  return runtime;
}
/** For tests and the CLI: install a runtime without a database. */
export function setCoursesRuntime(rt: CoursesRuntime | undefined): void {
  runtime = rt;
}

const NO_LOAD =
  "The course data has not been loaded on this server yet, so course answers are unavailable right now.";
const DOWN =
  "The course database could not be reached just now. Please try again shortly.";

/** Runs a catalogue read, turning a missing runtime, an empty load or an outage into a not-found result. */
export async function withCatalogue<T>(
  fn: (cat: Catalogue) => Grounded<T> | Promise<Grounded<T>>,
): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt)
    return notFound(
      "data_unavailable",
      "The course database is not configured on this server, so courses cannot be looked up right now.",
    );
  try {
    return await fn(await rt.courses.catalogue());
  } catch (e) {
    if (e instanceof NoCourseLoad) return notFound("data_unavailable", NO_LOAD);
    console.error(`course read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", DOWN);
  }
}

export async function startCourses(
  env: NodeJS.ProcessEnv = process.env,
): Promise<(() => Promise<void>) | undefined> {
  const cfg = dbConfig(env);
  if (!cfg) return undefined;
  const db = createDb({ ...cfg, statementTimeoutMs: STATEMENT_TIMEOUT_MS });
  const courses = new CourseStore(db);
  let cat: Catalogue | undefined;
  const refresh = async () => {
    try {
      cat = await courses.catalogue();
    } catch {
      /* readiness reports it */
    }
  };
  await refresh();

  registerDataSet({
    id: "cricos-register",
    vertical: "courses-domestic",
    title: "CRICOS course index (domestic search)",
    publisher: "Australian Government Department of Education (CRICOS, on data.gov.au)",
    source: {
      name: "CRICOS register, via data.gov.au",
      url: "https://data.gov.au/",
      licence: "CC BY 2.5 AU",
    },
    coverage:
      "Undergraduate courses of the listed universities that are registered on CRICOS. Domestic-only courses may be missing. No entry figures or prerequisites.",
    refreshedAt: () => cat?.loadedAt,
    maxAgeHours: 400 * 24,
    stats: () => ({ courses: cat?.courses.length ?? 0 }),
  });

  addReadinessCheck(
    "domestic-courses",
    async () => {
      try {
        if (!(await schemaCurrent(db, COURSES_REQUIRED_SCHEMA)))
          return { ok: false, reason: "schema_behind" };
        await refresh();
        return cat && cat.courses.length > 0
          ? { ok: true }
          : { ok: false, reason: "no_data_loaded" };
      } catch {
        return { ok: false, reason: "database_unreachable" };
      }
    },
    "courses-domestic",
  );

  runtime = {
    courses,
    stop: async () => ((runtime = undefined), db.close()),
  };
  return runtime.stop;
}
