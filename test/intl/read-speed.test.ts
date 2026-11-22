/**
 * Regression: reading the international store with the real data size must fit the server's 3 second statement
 * timeout. A per-course subquery on `courses.cricos_code` (no index) took about 6 seconds for 23,000 courses, the
 * read failed silently and /readyz said no_data_loaded although the load had succeeded.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { IntlStore } from "../../src/intl/load.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;

d("international store read at full size", () => {
  beforeAll(async () => {
    const setup = createDb({ url: URL!, schema, poolMax: 2 });
    await migrate(setup);
    await setup.pool.query(`SET search_path TO ${schema}`);
    const c = await setup.pool.connect();
    try {
      await c.query(`SET search_path TO ${schema}`);
      await c.query("INSERT INTO intl_providers (id, name) SELECT 'P'||g, 'Provider '||g FROM generate_series(1,1100) g");
      await c.query(
        `INSERT INTO intl_courses (cricos_code, provider_id, name, level, level_group)
         SELECT lpad(g::text, 6, '0')||'A', 'P'||(1 + g % 1100), 'Course '||g, 'Bachelor Degree', 'bachelor'
         FROM generate_series(1,24000) g`,
      );
      await c.query(
        `INSERT INTO intl_course_locations (cricos_code, state, campus)
         SELECT lpad(g::text, 6, '0')||'A', 'VIC', 'Campus '||(g % 3) FROM generate_series(1,24000) g`,
      );
      await c.query("INSERT INTO providers (id, name, courses_url) VALUES ('u','U','https://u.edu.au/')");
      await c.query(
        `INSERT INTO courses (id, provider_id, origin, depth, name, level, cricos_code)
         SELECT 'u-'||g, 'u', 'cricos', 'index_only', 'Course '||g, 'bachelor', lpad(g::text, 6, '0')||'A'
         FROM generate_series(1,4000) g`,
      );
      await c.query(
        "INSERT INTO intl_loads (source_file, source_date, row_count) VALUES ('x', '2026-11-02', 24000)",
      );
    } finally {
      c.release();
    }
    await setup.close();
    db = createDb({ url: URL!, schema, poolMax: 2, statementTimeoutMs: 3000 });
  }, 60_000);
  afterAll(async () => {
    await db.close();
    const c = new pg.Client({ connectionString: URL });
    await c.connect();
    await c.query(`DROP SCHEMA ${schema} CASCADE`);
    await c.end();
  });

  it("reads 24,000 courses under the 3 second statement timeout and still links domestic courses", async () => {
    const t = Date.now();
    const data = await new IntlStore(db, 0).data();
    expect(Date.now() - t).toBeLessThan(3000);
    expect(data.courses).toHaveLength(24000);
    expect(data.courses.filter((x) => x.domesticCourseId).length).toBe(4000);
    expect(data.courses.find((x) => x.cricosCode === "000001A")?.domesticCourseId).toBe("u-1");
  });
});
