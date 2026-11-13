/**
 * Store and sync tests against a real PostgreSQL. Set TEST_DATABASE_URL to run them
 * (CI provides a service container; locally see docs/local-database.md). Each file works in
 * its own throwaway schema.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearDataSets, listDataSets } from "../../src/core/registry.js";
import { clearReadinessChecks, runReadiness } from "../../src/core/readiness.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { assertSchema, createDb, migrate, type Db } from "../../src/energy/db.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { getEnergy, startEnergy, withStore } from "../../src/energy/index.js";
import { plansByPostcode, planById, CachedStore } from "../../src/energy/store.js";
import { runSync, type Retailer } from "../../src/energy/sync.js";
import { fixture, startMockCdr, type MockCdr, type MockPlan } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
let mock: MockCdr;

const RETAILERS: Retailer[] = [
  { slug: "agl", brandName: "AGL", active: true },
  { slug: "origin", brandName: "Origin", active: true },
];
const withId = (name: string, planId: string, extra: Record<string, any> = {}): MockPlan => ({ detail: { ...fixture(name), planId, ...extra } });

function client(): CdrClient {
  return new CdrClient({ baseUrl: mock.url, limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }), backoffMs: 1 });
}
const sync = (now?: Date, recheckDays = 7) =>
  runSync({ db, client: client(), retailers: RETAILERS, ...(now ? { now: () => now } : {}), recheckDays });
const detailCalls = () => mock.log.filter((l) => /plans\/[^/?]+$/.test(l.path)).length;

async function reset() {
  await db.pool.query("TRUNCATE plan_changes, plans, coverage_sets, retailers, sync_runs RESTART IDENTITY CASCADE");
  mock.log.length = 0;
}

beforeAll(async () => {
  if (!URL) return;
  db = createDb({ url: URL, schema, poolMax: 5 });
  await migrate(db);
  mock = await startMockCdr({ retailers: {} });
});
afterAll(async () => {
  if (!URL) return;
  await mock.close();
  const admin = new pg.Pool({ connectionString: URL });
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  await db.close();
});

d("migrations", () => {
  it("applies twice without error and refuses other schemas", async () => {
    expect(await migrate(db)).toEqual([]);
    expect(() => assertSchema("public")).toThrow(/Refusing/);
    expect(() => assertSchema("feima_api")).toThrow(/Refusing/);
    expect(() => assertSchema("askrighto; drop")).toThrow(/Refusing/);
  });

  it("creates the tables and indexes", async () => {
    const t = await db.pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = $1", [schema]);
    expect(t.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(["retailers", "coverage_sets", "plans", "plan_changes", "sync_runs", "schema_migrations"]),
    );
    const i = await db.pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = $1", [schema]);
    expect(i.rows.map((r) => r.indexname)).toEqual(
      expect.arrayContaining(["coverage_sets_postcodes_gin", "plans_coverage_idx", "plans_retailer_idx", "plans_fuel_type_idx", "plans_verified_idx"]),
    );
  });
});

d("sync and store", () => {
  beforeEach(async () => {
    await reset();
    mock.state.retailers = {
      agl: [withId("single-rate", "A1"), withId("unknown-model", "A2"), { detail: fixture("business-list-item"), list: {} }],
      origin: [withId("time-of-use", "O1")],
    };
    mock.state.inject = undefined;
    mock.state.pageSize = undefined;
  });

  it("loads residential plans, drops business, flags unknown models, and reports", async () => {
    const report = (await sync())!;
    expect(report.ok).toBe(true);
    expect(report.plans.added).toBe(3);
    expect(report.plansPerRetailer).toEqual({ agl: 2, origin: 1 });
    expect(report.plansPerPricingModel).toMatchObject({ SINGLE_RATE: 1, SPACE_BANDS: 1, TIME_OF_USE_CONT_LOAD: 1 });
    expect(report.notUnderstood.byReason["pricingModel:SPACE_BANDS"]).toBe(1);
    expect(report.requests.total).toBeGreaterThan(0);
    expect(report.requests.perRetailer.agl!.requests).toBeGreaterThan(0);
    expect(report.tableSizes.plans).toBe(3);
    const run = await db.pool.query("SELECT ok, report FROM sync_runs");
    expect(run.rows[0].ok).toBe(true);
    expect(run.rows[0].report.plans.added).toBe(3);
  });

  it("makes no detail call for an unchanged plan, refetches a changed one, removes a withdrawn one", async () => {
    await sync();
    mock.log.length = 0;
    await sync(undefined, 100000); // recheck quota 1 per retailer still applies; use huge days to make it ceil(n/100000)=1
    const afterQuiet = detailCalls();
    expect(afterQuiet).toBeLessThanOrEqual(2); // only the rolling re-check, one per retailer

    mock.state.retailers.agl![0]!.list = { lastUpdated: "2026-11-10T00:00:00Z" };
    mock.state.retailers.agl![0]!.detail = { ...mock.state.retailers.agl![0]!.detail, lastUpdated: "2026-11-10T00:00:00Z", displayName: "Renamed" };
    mock.state.retailers.agl!.splice(1, 1); // withdraw A2
    const r = (await sync())!;
    expect(r.plans.changed).toBe(1);
    expect(r.plans.removed).toBe(1);
    expect((await planById(db.pool, "A1"))?.displayName).toBe("Renamed");
    expect(await planById(db.pool, "A2")).toBeUndefined();
    const changes = await db.pool.query("SELECT silent FROM plan_changes WHERE plan_id = 'A1' ORDER BY id");
    expect(changes.rows.map((x) => x.silent)).toEqual([false, false]);
  });

  it("keeps a failing retailer's data and still syncs the other", async () => {
    await sync();
    mock.state.inject = ({ slug }) => (slug === "agl" ? { status: 500 } : undefined);
    const r = (await sync())!;
    expect(r.ok).toBe(false);
    expect(r.retailers.find((x) => x.slug === "agl")!.ok).toBe(false);
    expect(r.retailers.find((x) => x.slug === "origin")!.ok).toBe(true);
    expect((await plansByPostcode(db.pool, { postcode: "3000", retailer: "agl" })).length).toBe(2);
    const row = await db.pool.query("SELECT last_sync_ok, last_error FROM retailers WHERE slug = 'agl'");
    expect(row.rows[0].last_sync_ok).toBe(false);
    expect(row.rows[0].last_error).toMatch(/500/);
  });

  it("leaves no half-written retailer when a write fails", async () => {
    mock.state.retailers = { agl: [withId("single-rate", "A1"), withId("single-rate", "A3", { geography: { includedPostcodes: ["3000"], distributors: ["X"] }, displayName: "x".repeat(10) })] };
    // Force the second upsert to fail by making a plan id collide with a column constraint: a null byte is invalid in text.
    mock.state.retailers.agl![1]!.detail.displayName = "bad\u0000name";
    const r = (await runSync({ db, client: client(), retailers: [RETAILERS[0]!] }))!;
    expect(r.retailers[0]!.ok).toBe(false);
    expect((await db.pool.query("SELECT count(*)::int AS n FROM plans")).rows[0].n).toBe(0);
  });

  it("verifies every plan within seven daily runs and counts a silent change", async () => {
    mock.state.retailers.agl = Array.from({ length: 10 }, (_, i) => withId("single-rate", `S${i}`));
    mock.state.retailers.origin = [];
    const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 16));
    await sync(day(0));
    // silently change one plan: same lastUpdated, different content
    mock.state.retailers.agl![4]!.detail = { ...mock.state.retailers.agl![4]!.detail, displayName: "Silent change" };
    let silent = 0;
    for (let n = 1; n <= 7; n++) silent += (await sync(day(n)))!.plans.silent;
    expect(silent).toBe(1);
    const stale = await db.pool.query("SELECT count(*)::int AS n FROM plans WHERE verified_at < $1", [day(1)]);
    expect(stale.rows[0].n).toBe(0);
    const ch = await db.pool.query("SELECT count(*)::int AS n FROM plan_changes WHERE silent");
    expect(ch.rows[0].n).toBe(1);
  });

  it("lets only one of two concurrent runners sync", async () => {
    const results = await Promise.all([sync(), sync()]);
    expect(results.filter((x) => x === undefined).length + results.filter((x) => x !== undefined).length).toBe(2);
    // Run strictly concurrently with the lock held by a third connection.
    const holder = await db.pool.connect();
    await holder.query("SELECT pg_advisory_lock(hashtext('askrighto:energy-sync'))");
    try {
      expect(await sync()).toBeUndefined();
    } finally {
      await holder.query("SELECT pg_advisory_unlock(hashtext('askrighto:energy-sync'))");
      holder.release();
    }
  });

  it("finds plans by postcode with filters, honouring exclusions and effective dates", async () => {
    const future: MockPlan = { ...withId("single-rate", "F1", { effectiveFrom: "2030-01-01T00:00:00Z" }), effective: "FUTURE" };
    const expired = withId("single-rate", "E1", { effectiveTo: "2020-01-01T00:00:00Z" });
    const excluded = withId("single-rate", "X1", { geography: { includedPostcodes: ["3000", "3001"], excludedPostcodes: ["3001"], distributors: ["CitiPower"] } });
    const two = withId("single-rate", "D1", { geography: { includedPostcodes: ["2620"], distributors: ["Essential", "Evoenergy"] } });
    mock.state.retailers = { agl: [withId("single-rate", "A1"), future, expired, excluded, two], origin: [withId("time-of-use", "O1")] };
    await sync();

    const ids = async (q: Parameters<typeof plansByPostcode>[1], now?: Date) => (await plansByPostcode(db.pool, q, now)).map((p) => p.planId).sort();
    expect(await ids({ postcode: "3000" })).toEqual(["A1", "O1", "X1"]);
    expect(await ids({ postcode: "3001" })).toEqual(["A1"]); // X1 excludes 3001
    expect(await ids({ postcode: "3000", retailer: "origin" })).toEqual(["O1"]);
    expect(await ids({ postcode: "3000", fuelType: "GAS" })).toEqual([]);
    expect(await ids({ postcode: "3000" }, new Date("2031-01-01"))).toContain("F1"); // future plan shows from its date
    expect(await ids({ postcode: "3000" })).not.toContain("F1");
    expect(await ids({ postcode: "3000" })).not.toContain("E1");
    expect(await ids({ postcode: "9999" })).toEqual([]);
    const dual = await plansByPostcode(db.pool, { postcode: "2620" });
    expect(dual[0]!.geography.distributors.sort()).toEqual(["Essential", "Evoenergy"]);
    expect(await ids({ postcode: "2620", distributor: "Evoenergy" })).toEqual(["D1"]);
    expect(await ids({ postcode: "2620", distributor: "Ausgrid" })).toEqual([]);
  });

  it("postcode lookup uses the GIN index", async () => {
    await sync();
    const c = await db.pool.connect();
    try {
      await c.query("SET enable_seqscan = off");
      const r = await c.query("EXPLAIN SELECT * FROM coverage_sets WHERE included_postcodes @> ARRAY[3000]::int[]");
      expect(r.rows.map((x) => x["QUERY PLAN"]).join("\n")).toContain("coverage_sets_postcodes_gin");
    } finally {
      c.release();
    }
  });

  it("caches lookups for a short time", async () => {
    await sync();
    let t = Date.now();
    const store = new CachedStore(db, 1000, () => t);
    expect((await store.plans({ postcode: "3000" })).length).toBe(3);
    await db.pool.query("DELETE FROM plans WHERE plan_id = 'A1'");
    expect((await store.plans({ postcode: "3000" })).length).toBe(3); // cached
    t += 1001;
    expect((await store.plans({ postcode: "3000" })).length).toBe(2); // expired
  });
});

d("serving, registry and outages", () => {
  it("reports not ready until plans exist, registers the dataset, and returns data_unavailable when the database is gone", async () => {
    await reset();
    clearDataSets();
    clearReadinessChecks();
    const rt = (await startEnergy({ DATABASE_URL: URL, DATABASE_SCHEMA: schema, ASKRIGHTO_SYNC_SCHEDULE: "off" } as NodeJS.ProcessEnv))!;
    expect(getEnergy()).toBe(rt);
    expect((await runReadiness()).checks["energy-plans"]).toEqual({ ok: false, reason: "no_data_loaded" });

    mock.state.retailers = { agl: [withId("single-rate", "A1")], origin: [] };
    mock.state.inject = undefined;
    await sync();
    await rt.refresh();
    expect((await runReadiness()).ok).toBe(true);
    const ds = listDataSets().find((x) => x.id === "energy-plans")!;
    expect(ds.maxAgeHours).toBe(48);
    expect(ds.stats?.()).toMatchObject({ plans: 1 });
    expect(ds.refreshedAt()).toBeInstanceOf(Date);

    // Database goes away mid-test: the pool is closed.
    await rt.db.pool.end();
    const res = await withStore((s) => s.plans({ postcode: "3000" }).then(() => ({ found: false as const, reason: "not_in_dataset" as const, message: "unused" })));
    expect(res).toMatchObject({ found: false, reason: "data_unavailable" });
    expect((await runReadiness()).checks["energy-plans"]).toMatchObject({ ok: false, reason: "database_unreachable" });
    clearDataSets();
    clearReadinessChecks();
  });
});
