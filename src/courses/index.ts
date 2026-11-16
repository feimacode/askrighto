/**
 * Courses vertical runtime: database access, dataset registration and readiness. With no DATABASE_URL the
 * module stays off and course tools report the data as unavailable. Only one query path (a cached snapshot)
 * touches the database, and it runs under a statement timeout.
 */
import { notFound, type Grounded } from "../core/grounded.js";
import { addReadinessCheck } from "../core/readiness.js";
import { registerDataSet } from "../core/registry.js";
import { createDb, dbConfig, schemaCurrent } from "../energy/db.js";
import { VceStore } from "../vce/load.js";
import type { VceData, VceSource } from "../vce/types.js";
import type { Catalogue, CatalogueSource } from "./catalogue.js";
import { CourseStore, NoCourseLoad } from "./load.js";

export const COURSES_REQUIRED_SCHEMA = 3;
const STATEMENT_TIMEOUT_MS = 2000;

export interface CoursesRuntime {
  courses: CatalogueSource;
  vce: VceSource;
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

const PUBLISHER_VCAA = "Victorian Curriculum and Assessment Authority and VTAC";
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

export async function withVce<T>(
  fn: (d: VceData) => Grounded<T> | Promise<Grounded<T>>,
): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt)
    return notFound(
      "data_unavailable",
      "The admissions database is not configured on this server, so this cannot be looked up right now.",
    );
  try {
    return await fn(await rt.vce.data());
  } catch (e) {
    console.error(`vce read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", DOWN);
  }
}

const OWN_WORDS = "Facts in our own words; see the official page";
const ds = (
  id: string,
  title: string,
  publisher: string,
  url: string,
  licence: string,
  coverage: string,
  refreshed: () => Date | undefined,
  stats?: () => Record<string, unknown>,
) =>
  registerDataSet({
    id,
    vertical: "courses",
    title,
    publisher,
    source: { name: title, url, licence },
    coverage,
    refreshedAt: refreshed,
    maxAgeHours: 400 * 24,
    ...(stats ? { stats } : {}),
  });

export async function startCourses(
  env: NodeJS.ProcessEnv = process.env,
): Promise<(() => Promise<void>) | undefined> {
  const cfg = dbConfig(env);
  if (!cfg) return undefined;
  const db = createDb({ ...cfg, statementTimeoutMs: STATEMENT_TIMEOUT_MS });
  const courses = new CourseStore(db);
  const vce = new VceStore(db);
  let cat: Catalogue | undefined;
  let vdata: VceData | undefined;
  const refresh = async () => {
    try {
      cat = await courses.catalogue();
    } catch {
      /* readiness reports it */
    }
    try {
      vdata = await vce.data();
    } catch {
      /* readiness reports it */
    }
  };
  await refresh();

  ds(
    "vic-courses",
    "Victorian university undergraduate courses",
    "Universities' own pages (facts in our own words) and CRICOS",
    "https://github.com/feimacode/askrighto/tree/main/data/courses/vic",
    OWN_WORDS,
    "Victorian university undergraduate courses; index for all, checked facts for the curated subset",
    () => cat?.loadedAt,
    () => ({
      courses: cat?.courses.length ?? 0,
      curated: cat?.courses.filter((c) => c.depth === "curated").length ?? 0,
    }),
  );
  ds(
    "vce-key-dates",
    "VCE and VTAC admissions dates",
    "VCAA and VTAC",
    "https://www.vtac.edu.au/dates",
    OWN_WORDS,
    "Admissions years 2027 and 2028 (partial)",
    () => vdata?.loadedAt,
  );
  ds(
    "vtac-preference-rules",
    "How VTAC preferences and offers work",
    "VTAC",
    "https://www.vtac.edu.au/offers",
    OWN_WORDS,
    "Preference and offer rules, summarised",
    () => vdata?.loadedAt,
  );
  ds(
    "vic-early-entry",
    "Victorian university early entry schemes",
    "Victorian universities",
    "https://www.vtac.edu.au/offers",
    OWN_WORDS,
    "Partial: schemes of six universities",
    () => vdata?.loadedAt,
  );
  ds(
    "vce-scaling",
    "VCE study scaling",
    PUBLISHER_VCAA,
    "https://www.vtac.edu.au/atar/scaling",
    "Awaiting VTAC's written permission",
    "Scaled scores at published raw scores",
    () => vdata?.scaling[0] && vdata.loadedAt,
  );
  ds(
    "vce-study-groupings",
    "VTAC study area groupings",
    PUBLISHER_VCAA,
    "https://www.vtac.edu.au/atar",
    "Awaiting VTAC's written permission",
    "Groupings used in the aggregate",
    () => vdata?.groupings[0] && vdata.loadedAt,
  );

  addReadinessCheck(
    "vic-courses",
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
    "courses",
  );

  runtime = {
    courses,
    vce,
    stop: async () => ((runtime = undefined), db.close()),
  };
  return runtime.stop;
}
