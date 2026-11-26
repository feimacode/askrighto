/** cricos:refresh against a real PostgreSQL (TEST_DATABASE_URL) in a throwaway schema, with a fake data.gov.au. */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { refreshCricos } from "../../src/cricos/refresh.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { fakeFetch, fixtureCsv } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const run = (f: ReturnType<typeof fakeFetch>, o: Record<string, unknown> = {}) =>
  refreshCricos({ db, fetch: f, minIntlCourses: 1, ...o });
const count = async (t: string) =>
  Number((await db.pool.query(`SELECT count(*) AS n FROM ${t}`)).rows[0].n);

const courses = fixtureCsv("courses.csv");
const extraRow = courses
  .split("\n")
  .find((l) => l.includes("000106F"))!
  .replace("000106F", "000107G");
const bigger = `${courses.trimEnd()}\n${extraRow}\n`;
const header = courses.split("\n").slice(0, 3).join("\n");

d("cricos:refresh", () => {
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 4 });
    await migrate(db);
  });
  afterAll(async () => {
    await db.close();
    const c = new pg.Client({ connectionString: URL });
    await c.connect();
    await c.query(`DROP SCHEMA ${schema} CASCADE`);
    await c.end();
  });

  it("loads the international store and the domestic index, dated by the dataset", async () => {
    const r = await run(fakeFetch({ modified: "2026-11-02T08:00:00" }));
    expect(r).toMatchObject({ status: "loaded", sourceDate: "2026-11-02" });
    expect(await count("intl_courses")).toBe(6);
    expect(await count("courses")).toBeGreaterThan(90);
    const l = await db.pool.query("SELECT source_date::text AS d, report FROM intl_loads");
    expect(l.rows[0].d).toBe("2026-11-02");
    expect(l.rows[0].report.fingerprint).toContain("id-courses@2026-11-02");
    expect(await count("cricos_raw")).toBe(6);
  });

  it("does nothing, and downloads nothing, when the dataset has not changed", async () => {
    const f = fakeFetch({ modified: "2026-11-02T08:00:00" });
    const r = await run(f);
    expect(r).toMatchObject({ status: "unchanged", domestic: "no_change" });
    expect(f.calls).toHaveLength(1);
    expect(await count("intl_loads")).toBe(1);
  });

  it("recognises identical content after a metadata-only change", async () => {
    const f = fakeFetch({ modified: "2026-11-03T08:00:00" });
    expect(await run(f)).toMatchObject({ status: "unchanged" });
    expect(f.calls).toHaveLength(4);
    expect(await count("intl_loads")).toBe(1);
  });

  it("keeps the old data when a guard fires, and force overrides the drop guard", async () => {
    const small = `${header}\n${courses.split("\n")[3]}\n`;
    const r = await run(fakeFetch({ modified: "2026-11-10T08:00:00", courses: small }));
    expect(r.status).toBe("aborted");
    expect((r as { reasons: string[] }).reasons.join()).toMatch(/international courses fell/);
    expect(await count("intl_courses")).toBe(6);
    const f = await run(fakeFetch({ modified: "2026-11-10T08:00:00", courses: small }), { force: true });
    expect(f.status).toBe("loaded");
    expect(await count("intl_courses")).toBe(1);
  });

  it("refuses an older file unless forced", async () => {
    const r = await run(fakeFetch({ modified: "2026-10-01T00:00:00", courses: bigger }));
    expect(r).toMatchObject({ status: "aborted" });
    expect((r as { reasons: string[] }).reasons.join()).toMatch(/older than/);
    const f = await run(fakeFetch({ modified: "2026-10-01T00:00:00", courses: bigger }), { force: true });
    expect(f).toMatchObject({ status: "loaded" });
    expect(await count("intl_courses")).toBe(7);
  });

  it("never loads past a missing required column, even forced", async () => {
    const broken = bigger.replace("Course Level", "Level of Course X");
    const r = await run(fakeFetch({ modified: "2026-12-01T00:00:00", courses: broken }), { force: true });
    expect(r.status).toBe("aborted");
    expect(await count("intl_courses")).toBe(7);
  });

  it("writes nothing on a dry run", async () => {
    const r = await run(fakeFetch({ modified: "2026-12-02T00:00:00", courses }), { dryRun: true });
    expect(r.status).toBe("dry_run");
    expect(await count("intl_courses")).toBe(7);
    expect(await count("intl_loads")).toBe(3);
  });

  it("aborts on a foreign host and leaves the data", async () => {
    const r = await run(fakeFetch({ modified: "2026-12-03T00:00:00", urlFor: { courses: "https://evil.example/c.csv" } }));
    expect(r.status).toBe("aborted");
    expect(await count("intl_courses")).toBe(7);
  });

  it("skips when another instance holds the lock", async () => {
    const other = await db.pool.connect();
    try {
      await other.query("SELECT pg_advisory_lock(hashtext($1))", [`askrighto-cricos:${db.schema}`]);
      expect(await run(fakeFetch({ modified: "2026-12-04T00:00:00" }))).toEqual({ status: "locked" });
    } finally {
      await other.query("SELECT pg_advisory_unlock(hashtext($1))", [`askrighto-cricos:${db.schema}`]);
      other.release();
    }
  });
});
