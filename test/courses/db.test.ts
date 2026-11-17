/** Course load and store against a real PostgreSQL (TEST_DATABASE_URL), in a throwaway schema. */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clearReadinessChecks,
  runReadiness,
} from "../../src/core/readiness.js";
import { clearDataSets, listDataSets } from "../../src/core/registry.js";
import { getCourses, startCourses } from "../../src/courses/index.js";
import {
  CourseStore,
  loadCourses,
  mergeIndex,
  NoCourseLoad,
} from "../../src/courses/load.js";
import { parseProviderFile } from "../../src/courses/validate.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { loadVce, readVceFiles, VceStore } from "../../src/vce/load.js";
import { FIXTURE_YAML, fixtureVce } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const merged = () => mergeIndex([parseProviderFile(FIXTURE_YAML).file!]);

d("course store", () => {
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 3 });
    await migrate(db);
  });
  afterAll(async () => {
    await db.close();
    const c = new pg.Client({ connectionString: URL });
    await c.connect();
    await c.query(`DROP SCHEMA ${schema} CASCADE`);
    await c.end();
  });

  it("is not ready before the first load", async () => {
    await expect(new CourseStore(db, 0).catalogue()).rejects.toBeInstanceOf(
      NoCourseLoad,
    );
  });

  it("loads once, then a second load of the same content changes nothing", async () => {
    expect((await loadCourses(db, merged())).changed).toBe(true);
    expect((await loadCourses(db, merged())).changed).toBe(false);
    const n = await db.pool.query(
      "SELECT count(*)::int AS n FROM course_loads",
    );
    expect(n.rows[0].n).toBe(1);
  });

  it("reads back courses with figures, prerequisites and depth", async () => {
    const cat = await new CourseStore(db, 0).catalogue();
    const sci = cat.courses.find((c) => c.id === "testu-science")!;
    expect(sci.depth).toBe("curated");
    expect(sci.entryFigures.map((f) => f.kind).sort()).toEqual([
      "guaranteed_atar",
      "lowest_selection_rank",
    ]);
    expect(sci.prerequisites[0]!.rules).toHaveLength(3);
    expect(sci.otherCriteria[0]!.kind).toBe("folio");
    expect(cat.courses.find((c) => c.id === "testu-nursing")!.depth).toBe(
      "index_only",
    );
  });

  it("a failed load leaves the previous set", async () => {
    const bad = merged();
    bad.courses = [
      ...bad.courses,
      { ...bad.courses[0]!, id: "testu-extra", providerId: "no-such-provider" },
    ];
    bad.report = { ...bad.report, hash: "different" };
    await expect(loadCourses(db, bad)).rejects.toThrow();
    const cat = await new CourseStore(db, 0).catalogue();
    expect(cat.courses.map((c) => c.id)).toContain("testu-science");
    expect(cat.courses.some((c) => c.id === "testu-extra")).toBe(false);
  });

  it("cancels a slow query under the statement timeout", async () => {
    const slow = createDb({
      url: URL!,
      schema,
      poolMax: 1,
      statementTimeoutMs: 100,
    });
    try {
      await expect(slow.pool.query("SELECT pg_sleep(2)")).rejects.toThrow(
        /statement timeout/,
      );
    } finally {
      await slow.close();
    }
  });

  it("loads VCE data and reads it back", async () => {
    await loadVce(db, {
      ...readVceFiles(`${process.cwd()}/data`).data,
      scaling: fixtureVce().scaling,
      groupings: fixtureVce().groupings,
    });
    const v = await new VceStore(db, 0).data();
    expect(
      v.keyDates.find((k) => k.year === 2027)!.dates.length,
    ).toBeGreaterThan(10);
    expect(v.earlyEntry.length).toBeGreaterThan(3);
    expect(v.scaling[0]!.studies.length).toBeGreaterThan(5);
  });

  it("startCourses registers the datasets under the courses vertical and reports ready", async () => {
    clearDataSets();
    clearReadinessChecks();
    const stop = await startCourses({
      DATABASE_URL: URL!,
      DATABASE_SCHEMA: schema,
    } as NodeJS.ProcessEnv);
    expect(getCourses()).toBeTruthy();
    expect(listDataSets().map((x) => x.id)).toEqual(
      expect.arrayContaining(["vic-courses", "vce-scaling", "vic-early-entry"]),
    );
    expect(listDataSets().every((x) => x.vertical === "courses-domestic")).toBe(true);
    expect(
      (await runReadiness(["courses-domestic"])).checks["vic-courses"],
    ).toMatchObject({ ok: true, vertical: "courses-domestic" });
    expect(
      (await runReadiness(["energy"])).checks["vic-courses"],
    ).toBeUndefined();
    await stop!();
  });

  it("with the course migration missing, readiness says schema_behind and the server does not fail", async () => {
    const other = `askrighto_test_${randomBytes(4).toString("hex")}`;
    const db2 = createDb({ url: URL!, schema: other, poolMax: 2 });
    const c = new pg.Client({ connectionString: URL });
    await c.connect();
    try {
      await db2.pool.query(`CREATE SCHEMA ${other}`).catch(() => {});
      await c.query(
        `CREATE SCHEMA IF NOT EXISTS ${other}; CREATE TABLE ${other}.schema_migrations (version integer PRIMARY KEY, name text, applied_at timestamptz DEFAULT now()); INSERT INTO ${other}.schema_migrations (version, name) VALUES (1, 'init')`,
      );
      clearDataSets();
      clearReadinessChecks();
      const stop = await startCourses({
        DATABASE_URL: URL!,
        DATABASE_SCHEMA: other,
      } as NodeJS.ProcessEnv);
      expect(
        (await runReadiness(["courses-domestic"])).checks["vic-courses"],
      ).toMatchObject({ ok: false, reason: "schema_behind" });
      await stop!();
    } finally {
      await db2.close();
      await c.query(`DROP SCHEMA ${other} CASCADE`);
      await c.end();
    }
  });
});
