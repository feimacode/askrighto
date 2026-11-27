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
import { parseCricos } from "../../src/courses/cricos.js";
import { CRICOS_CSV, FIXTURE_YAML } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const merged = () =>
  mergeIndex([parseProviderFile(FIXTURE_YAML).file!], parseCricos(CRICOS_CSV).courses);

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

  it("reads back index rows with campuses and no facts", async () => {
    const cat = await new CourseStore(db, 0).catalogue();
    const law = cat.courses.find((c) => c.cricosCode === "111111A")!;
    expect(law.campuses.sort()).toEqual(["Clayton", "Parkville"]);
    expect(law.durationYears).toBe(4);
    expect(law).not.toHaveProperty("entryFigures");
  });

  it("migration 0011 dropped the fact tables", async () => {
    for (const t of ["course_entry_figures", "course_prerequisites", "vce_scaling", "home_loan_products", "reference_rates"]) {
      const r = await db.pool.query("SELECT to_regclass($1) AS t", [t]);
      expect(r.rows[0].t).toBeNull();
    }
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
    expect(cat.courses.map((c) => c.id)).toContain("testu-cricos-111111a");
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

  it("startCourses registers the datasets under the courses vertical and reports ready", async () => {
    clearDataSets();
    clearReadinessChecks();
    const stop = await startCourses({
      DATABASE_URL: URL!,
      DATABASE_SCHEMA: schema,
    } as NodeJS.ProcessEnv);
    expect(getCourses()).toBeTruthy();
    expect(listDataSets().map((x) => x.id)).toEqual(
      expect.arrayContaining(["cricos-register"]),
    );
    expect(listDataSets().every((x) => x.vertical === "courses-domestic")).toBe(true);
    expect(
      (await runReadiness(["courses-domestic"])).checks["domestic-courses"],
    ).toMatchObject({ ok: true, vertical: "courses-domestic" });
    expect(
      (await runReadiness(["energy"])).checks["domestic-courses"],
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
        (await runReadiness(["courses-domestic"])).checks["domestic-courses"],
      ).toMatchObject({ ok: false, reason: "schema_behind" });
      await stop!();
    } finally {
      await db2.close();
      await c.query(`DROP SCHEMA ${other} CASCADE`);
      await c.end();
    }
  });
});
