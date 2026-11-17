/**
 * Health cover vertical runtime. The rates come from data/health/rates.yaml and need no database; the product
 * data needs DATABASE_URL and a load. With no database the product tools report the data as unavailable but
 * the rules tool still works.
 */
import { notFound, type Grounded } from "../core/grounded.js";
import { addReadinessCheck } from "../core/readiness.js";
import { registerDataSet } from "../core/registry.js";
import { createDb, dbConfig, schemaCurrent } from "../energy/db.js";
import { HealthStore, NoHealthLoad } from "./load.js";
import { PHIO_SOURCE, RULES_SOURCE } from "./notice.js";
import { loadRates, overdueRules, type RatesData } from "./rules.js";
import type { HealthData, HealthSource } from "./types.js";

export const HEALTH_REQUIRED_SCHEMA = 5;
const STATEMENT_TIMEOUT_MS = 3000;

export interface HealthRuntime {
  health?: HealthSource;
  rates: RatesData;
  stop(): Promise<void>;
}
let runtime: HealthRuntime | undefined;
export const getHealth = () => runtime;
/** For tests and the CLI: install a runtime without a database. */
export function setHealthRuntime(rt: HealthRuntime | undefined): void {
  runtime = rt;
}

const NO_LOAD =
  "The private health cover data has not been loaded on this server yet, so these answers are unavailable right now.";
const DOWN = "The health cover database could not be reached just now. Please try again shortly.";

export async function withHealth<T>(
  fn: (d: HealthData, rates: RatesData) => Grounded<T> | Promise<Grounded<T>>,
): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt?.health)
    return notFound(
      "data_unavailable",
      "The private health cover database is not configured on this server, so products cannot be looked up right now.",
    );
  try {
    return await fn(await rt.health.data(), rt.rates);
  } catch (e) {
    if (e instanceof NoHealthLoad) return notFound("data_unavailable", NO_LOAD);
    console.error(`health read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", DOWN);
  }
}

/** For tools that need only the rules. */
export function withRates<T>(fn: (rates: RatesData) => Grounded<T>): Grounded<T> {
  if (!runtime)
    return notFound("data_unavailable", "The health cover rules are not loaded on this server, so rules cannot be looked up right now.");
  return fn(runtime.rates);
}

export async function startHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<(() => Promise<void>) | undefined> {
  const rates = loadRates();
  const overdue = overdueRules(rates);
  if (overdue.length) console.error(`warning: health cover rules past their review date: ${overdue.join(", ")}`);
  registerDataSet({
    id: "health-cover-rates",
    vertical: "health-cover",
    title: "Health cover rebate, surcharge and loading rules",
    publisher: "Australian Taxation Office and Department of Health, Disability and Ageing",
    source: { name: RULES_SOURCE.name, url: RULES_SOURCE.url, licence: RULES_SOURCE.licence },
    coverage: "Rebate tiers and rates, Medicare levy surcharge tiers and rates, Lifetime Health Cover loading; each with effective dates and status",
    refreshedAt: () => new Date(`${rates.loadedFrom}T00:00:00Z`),
    maxAgeHours: 200 * 24,
    stats: () => ({ rebateRows: rates.rebate.length, mlsRows: rates.mls.length, overdue: overdue.length }),
  });
  addReadinessCheck(
    "health-cover-rates",
    async () => (overdueRules(rates).length === 0 ? { ok: true } : { ok: false, reason: "rules_past_review_date" }),
    "health-cover",
  );

  const cfg = dbConfig(env);
  if (!cfg) {
    runtime = { rates, stop: async () => void (runtime = undefined) };
    return runtime.stop;
  }
  const db = createDb({ ...cfg, statementTimeoutMs: STATEMENT_TIMEOUT_MS });
  const store = new HealthStore(db);
  let snap: HealthData | undefined;
  const refresh = async () => {
    try {
      snap = await store.data();
    } catch {
      /* readiness reports it */
    }
  };
  await refresh();
  registerDataSet({
    id: "health-cover-products",
    vertical: "health-cover",
    title: "Private health insurance products (PHIO monthly file)",
    publisher: "Private Health Insurance Ombudsman",
    source: { name: PHIO_SOURCE.name, url: PHIO_SOURCE.url, licence: PHIO_SOURCE.licence },
    coverage: "Products in the PHIO monthly file, as published; not necessarily every fund or the whole market",
    refreshedAt: () => snap?.sourceDate,
    maxAgeHours: 45 * 24,
    stats: () => ({ insurers: snap?.insurers.length ?? 0, products: snap?.products.length ?? 0 }),
  });
  addReadinessCheck(
    "health-cover-products",
    async () => {
      try {
        if (!(await schemaCurrent(db, HEALTH_REQUIRED_SCHEMA))) return { ok: false, reason: "schema_behind" };
        await refresh();
        return snap && snap.products.length > 0 ? { ok: true } : { ok: false, reason: "no_data_loaded" };
      } catch {
        return { ok: false, reason: "database_unreachable" };
      }
    },
    "health-cover",
  );
  runtime = { health: store, rates, stop: async () => ((runtime = undefined), db.close()) };
  return runtime.stop;
}
