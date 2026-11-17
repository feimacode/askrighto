/**
 * Home loan runtime. With no DATABASE_URL the module stays off and tools report the data as unavailable.
 * Reads come from a cached snapshot (a few thousand products); the daily sync replaces it. The sync only
 * runs on the schedule once data has been loaded by `homeloans:sync`, never as a first load.
 */
import lendersJson from "./lenders.json" with { type: "json" };
import { notFound, type Grounded } from "../core/grounded.js";
import { addReadinessCheck } from "../core/readiness.js";
import { registerDataSet } from "../core/registry.js";
import { RetailerLimiter } from "../cdr/limiter.js";
import { createDb, dbConfig, schemaCurrent, type Db } from "../energy/db.js";
import { nextRunAt } from "../energy/schedule.js";
import { BankingClient } from "./client.js";
import { BANK_SOURCE, RBA_SOURCE } from "./notices.js";
import { readAll } from "./store.js";
import { runHomeLoanSync } from "./sync.js";
import type { HomeLoanData, Lender } from "./types.js";

export const HOME_LOAN_REQUIRED_SCHEMA = 5;
export const HOME_LOAN_DATASET_ID = "home-loans-cdr";
export const CASH_RATE_DATASET_ID = "rba-cash-rate";
const SNAPSHOT_TTL_MS = 60_000;
/** A lender that has not synced successfully in this long is reported as not answering. */
export const ANSWERING_WINDOW_MS = 48 * 3600_000;

export const LENDERS: Lender[] = lendersJson as Lender[];

export interface HomeLoanRuntime {
  db: Db;
  data(): Promise<HomeLoanData>;
  refresh(): Promise<void>;
  /** Lender slugs removed from every result (ASKRIGHTO_HOME_LOAN_EXCLUDE). */
  excluded: ReadonlySet<string>;
  stop(): Promise<void>;
}

let runtime: HomeLoanRuntime | undefined;
export const getHomeLoans = (): HomeLoanRuntime | undefined => runtime;
/** For tests: install a runtime without a database. */
export function setHomeLoanRuntime(rt: Pick<HomeLoanRuntime, "data" | "excluded"> | undefined): void {
  runtime = rt as HomeLoanRuntime | undefined;
}

export function parseExclusions(env: NodeJS.ProcessEnv): Set<string> {
  return new Set((env.ASKRIGHTO_HOME_LOAN_EXCLUDE ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
}

export function makeBankingClient(env: NodeJS.ProcessEnv = process.env, recorder?: ConstructorParameters<typeof BankingClient>[0]["recorder"]): BankingClient {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return new BankingClient({
    limiter: new RetailerLimiter({
      rps: num(env.ASKRIGHTO_SYNC_PER_RETAILER_RPS, 2),
      maxInFlight: num(env.ASKRIGHTO_SYNC_MAX_IN_FLIGHT, 8),
    }),
    ...(recorder ? { recorder } : {}),
  });
}

export async function withHomeLoans<T>(
  fn: (d: HomeLoanData, rt: Pick<HomeLoanRuntime, "excluded">) => Grounded<T> | Promise<Grounded<T>>,
): Promise<Grounded<T>> {
  const rt = runtime;
  if (!rt)
    return notFound("data_unavailable", "The home loan database is not configured on this server, so loans cannot be looked up right now.");
  try {
    const d = await rt.data();
    if (d.products.length === 0)
      return notFound("no_data_loaded", "Home loan data has not been loaded on this server yet, so these answers are unavailable right now.");
    return await fn(d, rt);
  } catch (e) {
    console.error(`home loan read failed: ${(e as Error).message}`);
    return notFound("data_unavailable", "The home loan database could not be reached just now. Please try again shortly.");
  }
}

export async function startHomeLoans(env: NodeJS.ProcessEnv = process.env): Promise<(() => Promise<void>) | undefined> {
  const cfg = dbConfig(env);
  if (!cfg) return undefined;
  const db = createDb({ ...cfg, statementTimeoutMs: 3000 });
  let snap: HomeLoanData | undefined;
  let at = 0;
  const refresh = async () => {
    try {
      snap = await readAll(db);
      at = Date.now();
    } catch {
      /* keep the last snapshot; readiness reports the outage */
    }
  };
  await refresh();

  registerDataSet({
    id: HOME_LOAN_DATASET_ID,
    vertical: "home-loans",
    title: "Home loans (lenders' Consumer Data Right product data)",
    publisher: "Each lender, via the Consumer Data Right",
    source: BANK_SOURCE,
    coverage: "Residential mortgage products of the lenders that publish them through the Consumer Data Right; not every lender in the market",
    refreshedAt: () => snap?.lastVerified,
    maxAgeHours: 48,
    stats: () => ({
      lenders: snap?.lenders.length ?? 0,
      products: snap?.products.length ?? 0,
      notUnderstood: snap?.products.filter((p) => !p.understood).length ?? 0,
      failingLenders: snap?.lenders.filter((l) => l.lastSyncOk === false).map((l) => l.slug) ?? [],
    }),
  });
  registerDataSet({
    id: CASH_RATE_DATASET_ID,
    vertical: "home-loans",
    title: "RBA cash rate target",
    publisher: "Reserve Bank of Australia",
    source: { name: RBA_SOURCE.name, url: RBA_SOURCE.url, licence: RBA_SOURCE.licence, attribution: RBA_SOURCE.attribution },
    coverage: "The cash rate target and the date it took effect",
    refreshedAt: () => snap?.cashRate?.fetchedAt,
    maxAgeHours: 24 * 120,
  });
  addReadinessCheck(
    "home-loans",
    async () => {
      try {
        if (!(await schemaCurrent(db, HOME_LOAN_REQUIRED_SCHEMA))) return { ok: false, reason: "schema_behind" };
        await refresh();
        return snap && snap.products.length > 0 ? { ok: true } : { ok: false, reason: "no_data_loaded" };
      } catch {
        return { ok: false, reason: "database_unreachable" };
      }
    },
    "home-loans",
  );

  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  if (env.ASKRIGHTO_SYNC_SCHEDULE !== "off") {
    const [hh, mm] = (env.ASKRIGHTO_HOME_LOAN_SYNC_AT ?? "03:30").split(":").map(Number) as [number, number];
    const tz = env.ASKRIGHTO_SYNC_TZ ?? "Australia/Sydney";
    const arm = () => {
      if (stopped) return;
      const wait = nextRunAt(new Date(), hh, mm, tz).getTime() - Date.now();
      timer = setTimeout(async () => {
        try {
          if (snap && snap.products.length > 0)
            await runHomeLoanSync({ db, client: makeBankingClient(env), lenders: LENDERS, log: (m) => console.error(`home loan sync: ${m}`) });
          await refresh();
        } catch (e) {
          console.error(`scheduled home loan sync failed: ${(e as Error).message}`);
        }
        arm();
      }, Math.min(wait, 2 ** 31 - 1));
      timer.unref();
    };
    arm();
  }

  runtime = {
    db,
    excluded: parseExclusions(env),
    async data() {
      if (!snap || Date.now() - at > SNAPSHOT_TTL_MS) await refresh();
      if (!snap) throw new Error("no snapshot");
      return snap;
    },
    refresh,
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      runtime = undefined;
      await db.close();
    },
  };
  return runtime.stop;
}
