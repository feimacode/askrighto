/** International store and coverage report against a real PostgreSQL (TEST_DATABASE_URL), in a throwaway schema. */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coverageReport, formatReport } from "../../src/compare/coverage.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { IntlStore, loadIntl, NoIntlLoad } from "../../src/intl/load.js";
import { parseIntlCricos } from "../../src/intl/parse.js";
import { FIXTURE } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const parsed = () => parseIntlCricos(readFileSync(FIXTURE, "utf8"));
const input = (date = "2026-02-02") => {
  const p = parsed();
  return {
    providers: p.providers,
    courses: p.courses,
    sourceFile: "intl-sample.csv",
    sourceDate: date,
    report: p.report,
  };
};

d("international store", () => {
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

  it("is not ready before the first load, and the coverage report says no data", async () => {
    await expect(new IntlStore(db, 0).data()).rejects.toBeInstanceOf(
      NoIntlLoad,
    );
    const r = await coverageReport(db);
    expect(r.international.loaded).toBe(false);
    expect(r.domestic.loaded).toBe(false);
    expect(formatReport(r)).toMatch(/no data loaded/);
  });

  it("loads and reads back with source date, locations and null fees", async () => {
    await loadIntl(db, input());
    const data = await new IntlStore(db, 0).data();
    expect(data.sourceDate.toISOString().slice(0, 10)).toBe("2026-02-02");
    expect(data.courses).toHaveLength(6);
    const ds = data.courses.find((c) => c.cricosCode === "000002B")!;
    expect(ds.locations).toHaveLength(2);
    expect(ds.tuitionFeeTotal).toBe(96000);
    expect(
      data.courses.find((c) => c.cricosCode === "000003C")!.tuitionFeeTotal,
    ).toBeUndefined();
  });

  it("replaces all rows on a second load and keeps old data when a load fails", async () => {
    const p = input("2026-03-02");
    await loadIntl(db, {
      ...p,
      courses: p.courses.slice(0, 2),
      providers: p.providers,
    });
    expect((await new IntlStore(db, 0).data()).courses).toHaveLength(2);
    await expect(
      loadIntl(db, {
        ...p,
        courses: [{ ...p.courses[0]!, providerId: "NOPE" }],
      }),
    ).rejects.toThrow();
    expect((await new IntlStore(db, 0).data()).courses).toHaveLength(2);
    await expect(loadIntl(db, { ...p, courses: [] })).rejects.toThrow(/empty/);
  });

  it("links to the domestic course with the same CRICOS code and reports coverage without writing", async () => {
    await db.pool.query(
      `INSERT INTO providers (id, name, courses_url) VALUES ('testu','Test University','https://www.testu.edu.au/courses')`,
    );
    await db.pool.query(
      `INSERT INTO courses (id, provider_id, origin, depth, name, level, fields, cricos_code) VALUES ('testu-science','testu','cricos','index_only','Bachelor of Science','bachelor','{science}','000001A')`,
    );
    await loadIntl(db, input());
    const data = await new IntlStore(db, 0).data();
    expect(
      data.courses.find((c) => c.cricosCode === "000001A")!.domesticCourseId,
    ).toBe("testu-science");
    const before = (
      await db.pool.query("SELECT count(*)::int AS n FROM intl_courses")
    ).rows[0].n;
    const r = await coverageReport(db, new Date("2026-03-04T00:00:00Z"));
    expect(r.international).toMatchObject({
      loaded: true,
      courses: 6,
      sourceDate: "2026-02-02",
      sourceAgeDays: 30,
    });
    expect(r.international.with.tuitionFee).toMatchObject({ count: 5, of: 6 });
    expect(r.international.with.inDomesticIndex?.count).toBe(1);
    expect(r.domestic).toMatchObject({
      loaded: true,
      courses: 1,
      indexOnly: 1,
      curated: 0,
    });
    expect(r.international.datasets[0]).toMatchObject({
      id: "intl-courses",
      productionReady: true,
    });
    expect(
      r.domestic.datasets.find((x) => x.id === "vce-scaling")!.productionReady,
    ).toBe(false);
    expect(
      (await db.pool.query("SELECT count(*)::int AS n FROM intl_courses"))
        .rows[0].n,
    ).toBe(before);
    expect(formatReport(r)).toMatch(/INTERNATIONAL/);
  });
});
