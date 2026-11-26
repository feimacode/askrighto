/**
 * International courses vertical runtime. With no DATABASE_URL the module stays off and the tools report the
 * data as unavailable. Reads come from a cached snapshot taken under a statement timeout.
 */
import { notFound, type Grounded } from "../core/grounded.js";
import { addReadinessCheck } from "../core/readiness.js";
import { registerDataSet } from "../core/registry.js";
import { createDb, dbConfig, schemaCurrent } from "../energy/db.js";
import { NoIntlLoad, IntlStore } from "./load.js";
import { CRICOS_SOURCE } from "./notice.js";
import type { IntlData, IntlSource } from "./types.js";

export const INTL_REQUIRED_SCHEMA = 4;
const STATEMENT_TIMEOUT_MS = 3000;

export interface IntlRuntime {
  intl: IntlSource;
  stop(): Promise<void>;
}
let runtime: IntlRuntime | undefined;
export function getIntl(): IntlRuntime | undefined {
  return runtime;
}
/** For tests and the CLI: install a runtime without a database. */
export function setIntlRuntime(rt: IntlRuntime | undefined): void {
  runtime = rt;
}

const NO_LOAD =
  "The international course data has not been loaded on this server yet, so these answers are unavailable right now.";
const DOWN =
  "The course database could not be reached just now. Please try again shortly.";

export async function withIntl<T>(
  fn: (d: IntlData) => Grounded<T> | Promise<Grounded<T>>,
): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt)
    return notFound(
      "data_unavailable",
      "The international course database is not configured on this server, so courses cannot be looked up right now.",
    );
  try {
    return await fn(await rt.intl.data());
  } catch (e) {
    if (e instanceof NoIntlLoad) return notFound("data_unavailable", NO_LOAD);
    console.error(`intl read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", DOWN);
  }
}

export async function startIntl(
  env: NodeJS.ProcessEnv = process.env,
): Promise<(() => Promise<void>) | undefined> {
  const cfg = dbConfig(env);
  if (!cfg) return undefined;
  const db = createDb({ ...cfg, statementTimeoutMs: STATEMENT_TIMEOUT_MS });
  const store = new IntlStore(db);
  let snap: IntlData | undefined;
  /** Why the last read failed, so readiness can tell "nothing loaded" from "the read failed". */
  let lastError: unknown;
  const refresh = async () => {
    try {
      snap = await store.data();
      lastError = undefined;
    } catch (e) {
      lastError = e;
      if (!(e instanceof NoIntlLoad))
        console.error(`intl read failed: ${(e as Error).message}`);
    }
  };
  await refresh();
  registerDataSet({
    id: "intl-courses",
    vertical: "cricos",
    title: "Courses for international students (CRICOS)",
    publisher: "Australian Government Department of Education (CRICOS)",
    source: {
      name: CRICOS_SOURCE.name,
      url: CRICOS_SOURCE.url,
      licence: CRICOS_SOURCE.licence,
    },
    coverage:
      "Higher-education courses registered for international students, all states and territories; fees and durations as published",
    refreshedAt: () => snap?.sourceDate,
    maxAgeHours: 90 * 24,
    stats: () => ({
      courses: snap?.courses.length ?? 0,
      providers: snap?.providers.length ?? 0,
    }),
  });
  addReadinessCheck(
    "intl-courses",
    async () => {
      try {
        if (!(await schemaCurrent(db, INTL_REQUIRED_SCHEMA)))
          return { ok: false, reason: "schema_behind" };
        await refresh();
        if (lastError && !(lastError instanceof NoIntlLoad))
          return { ok: false, reason: "read_failed" };
        return snap && snap.courses.length > 0
          ? { ok: true }
          : { ok: false, reason: "no_data_loaded" };
      } catch {
        return { ok: false, reason: "database_unreachable" };
      }
    },
    "cricos",
  );
  runtime = {
    intl: store,
    stop: async () => ((runtime = undefined), db.close()),
  };
  return runtime.stop;
}
