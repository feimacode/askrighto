/**
 * Energy plan data module: wires the database, store, dataset registration, readiness check
 * and the daily sync timer. Call `startEnergy()` once at server start; with no DATABASE_URL
 * the module stays off and tools report the data as unavailable.
 */
import retailersJson from "./retailers.json" with { type: "json" };
import { registerDataSet } from "../core/registry.js";
import { addReadinessCheck } from "../core/readiness.js";
import { notFound, type Grounded } from "../core/grounded.js";
import { CdrClient } from "./cdr-client.js";
import { createDb, dbConfig, schemaCurrent, type Db } from "./db.js";
import { RetailerLimiter } from "./limiter.js";
import { nextRunAt } from "./schedule.js";
import { CachedStore, summary, type StoreSummary } from "./store.js";
import { runSync, type Retailer } from "./sync.js";

export const ENERGY_DATASET_ID = "energy-plans";
export const ENERGY_SOURCE = {
  name: "Australian Energy Regulator, energy product reference data (Consumer Data Right)",
  url: "https://www.aer.gov.au/energy-product-reference-data",
  licence: "Consumer Data Right Rules, rule 2.6 (no restriction on use of product data)",
};

export const RETAILERS: Retailer[] = retailersJson as Retailer[];

export interface EnergyRuntime {
  db: Db;
  store: CachedStore;
  snapshot(): StoreSummary | undefined;
  refresh(): Promise<void>;
  stop(): Promise<void>;
}

let runtime: EnergyRuntime | undefined;

export function getEnergy(): EnergyRuntime | undefined {
  return runtime;
}

export function makeSyncDeps(env: NodeJS.ProcessEnv = process.env, recorder?: ConstructorParameters<typeof CdrClient>[0]["recorder"]) {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const limiter = new RetailerLimiter({
    rps: num(env.ASKRIGHTO_SYNC_PER_RETAILER_RPS, 2),
    maxInFlight: num(env.ASKRIGHTO_SYNC_MAX_IN_FLIGHT, 8),
  });
  return new CdrClient({
    limiter,
    ...(env.ASKRIGHTO_CDR_BASE ? { baseUrl: env.ASKRIGHTO_CDR_BASE } : {}),
    ...(recorder ? { recorder } : {}),
  });
}

export async function startEnergy(env: NodeJS.ProcessEnv = process.env): Promise<EnergyRuntime | undefined> {
  const cfg = dbConfig(env);
  if (!cfg) return undefined;
  const db = createDb(cfg);
  const store = new CachedStore(db);
  let snap: StoreSummary | undefined;
  const refresh = async () => {
    try {
      snap = await summary(db);
    } catch {
      /* keep the last snapshot; readiness reports the outage */
    }
  };
  await refresh();

  registerDataSet({
    id: ENERGY_DATASET_ID,
    title: "Electricity and gas plans (AER product reference data)",
    publisher: "Australian Energy Regulator, via the Consumer Data Right",
    source: ENERGY_SOURCE,
    coverage: "Residential electricity, gas and dual fuel plans from the retailers listed in the AER's product data, across the National Electricity Market states and the ACT",
    refreshedAt: () => snap?.lastSuccessfulSync,
    maxAgeHours: 48,
    stats: () => ({ retailers: snap?.retailers ?? 0, plans: snap?.plans ?? 0, failingRetailers: snap?.failingRetailers ?? [] }),
  });

  addReadinessCheck("energy-plans", async () => {
    try {
      if (!(await schemaCurrent(db))) return { ok: false, reason: "schema_behind" };
      await refresh();
      return snap && snap.plans > 0 ? { ok: true } : { ok: false, reason: "no_data_loaded" };
    } catch {
      return { ok: false, reason: "database_unreachable" };
    }
  });

  // Daily sync, default 02:30 Australia/Sydney. The advisory lock lets only one instance run it.
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  if (env.ASKRIGHTO_SYNC_SCHEDULE !== "off") {
    const [hh, mm] = (env.ASKRIGHTO_SYNC_AT ?? "02:30").split(":").map(Number) as [number, number];
    const tz = env.ASKRIGHTO_SYNC_TZ ?? "Australia/Sydney";
    const arm = () => {
      if (stopped) return;
      const wait = nextRunAt(new Date(), hh, mm, tz).getTime() - Date.now();
      timer = setTimeout(async () => {
        try {
          // Only runs when data was loaded once by `sync-energy`; the server never starts a first load.
          if (snap && snap.plans > 0) await runSync({ db, client: makeSyncDeps(env), retailers: RETAILERS, log: (m) => console.error(`sync: ${m}`) });
          await refresh();
          store.clear();
        } catch (e) {
          console.error(`scheduled sync failed: ${(e as Error).message}`);
        }
        arm();
      }, Math.min(wait, 2 ** 31 - 1));
      timer.unref();
    };
    arm();
  }

  runtime = {
    db,
    store,
    snapshot: () => snap,
    refresh,
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      await db.close();
      runtime = undefined;
    },
  };
  return runtime;
}

/**
 * Runs a store read, turning a missing or unreachable database into a not-found result.
 * Tools never answer plan questions from memory or another source.
 */
export async function withStore<T>(fn: (store: CachedStore) => Promise<Grounded<T>>): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt) return notFound("data_unavailable", "The energy plan database is not configured on this server, so plan details cannot be looked up right now.");
  try {
    return await fn(rt.store);
  } catch (e) {
    console.error(`energy store read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", "The energy plan database could not be reached just now, so plan details cannot be looked up. Please try again shortly.");
  }
}
