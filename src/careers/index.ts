/** Career outcomes vertical runtime. Needs DATABASE_URL and a load; with no database the tools report the data as unavailable. */
import { notFound, type Grounded } from "../core/grounded.js";
import { addReadinessCheck } from "../core/readiness.js";
import { registerDataSet } from "../core/registry.js";
import { createDb, dbConfig, schemaCurrent } from "../energy/db.js";
import { CareerStore, NoCareerLoad } from "./load.js";
import { CAREER_SOURCE } from "./notice.js";
import type { CareerData, CareerSource } from "./types.js";

export const CAREER_REQUIRED_SCHEMA = 7;
const STATEMENT_TIMEOUT_MS = 3000;

export interface CareerRuntime {
  careers?: CareerSource;
  stop(): Promise<void>;
}
let runtime: CareerRuntime | undefined;
export const getCareers = () => runtime;
/** For tests and the CLI: install a runtime without a database. */
export function setCareerRuntime(rt: CareerRuntime | undefined): void {
  runtime = rt;
}

const NO_LOAD = "The career outcomes data has not been loaded on this server yet, so these answers are unavailable right now.";
const DOWN = "The career outcomes database could not be reached just now. Please try again shortly.";

export async function withCareers<T>(fn: (d: CareerData) => Grounded<T> | Promise<Grounded<T>>): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt?.careers)
    return notFound("data_unavailable", "The career outcomes database is not configured on this server, so occupations cannot be looked up right now.");
  try {
    return await fn(await rt.careers.data());
  } catch (e) {
    if (e instanceof NoCareerLoad) return notFound("data_unavailable", NO_LOAD);
    console.error(`career outcomes read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", DOWN);
  }
}

export async function startCareers(env: NodeJS.ProcessEnv = process.env): Promise<(() => Promise<void>) | undefined> {
  const cfg = dbConfig(env);
  if (!cfg) {
    runtime = { stop: async () => void (runtime = undefined) };
    return runtime.stop;
  }
  const db = createDb({ ...cfg, statementTimeoutMs: STATEMENT_TIMEOUT_MS });
  const store = new CareerStore(db);
  let snap: CareerData | undefined;
  const refresh = async () => {
    try {
      snap = await store.data();
    } catch {
      /* readiness reports it */
    }
  };
  await refresh();
  registerDataSet({
    id: "career-outcomes",
    vertical: "career-outcomes",
    title: "Occupation employment projections (JSA)",
    publisher: "Jobs and Skills Australia",
    source: { name: CAREER_SOURCE.name, url: CAREER_SOURCE.url, licence: CAREER_SOURCE.licence },
    coverage: "ANZSCO occupation groups: employment at the baseline and two projection years, with growth; indicative projections as published",
    refreshedAt: () => snap?.sourceDate,
    maxAgeHours: 400 * 24,
    stats: () => ({ occupations: snap?.occupations.filter((o) => o.level === 4 && !o.nfd).length ?? 0 }),
  });
  addReadinessCheck(
    "career-outcomes",
    async () => {
      try {
        if (!(await schemaCurrent(db, CAREER_REQUIRED_SCHEMA))) return { ok: false, reason: "schema_behind" };
        await refresh();
        return snap && snap.occupations.length > 0 ? { ok: true } : { ok: false, reason: "no_data_loaded" };
      } catch {
        return { ok: false, reason: "database_unreachable" };
      }
    },
    "career-outcomes",
  );
  runtime = { careers: store, stop: async () => ((runtime = undefined), db.close()) };
  return runtime.stop;
}
