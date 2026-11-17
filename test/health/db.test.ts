/** Health store against a real PostgreSQL (TEST_DATABASE_URL), in a throwaway schema. */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { categoriesOf } from "../../src/health/types.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { HealthStore, loadHealth, NoHealthLoad } from "../../src/health/load.js";
import { parseHealthDir } from "../../src/health/parse.js";
import { FIXTURE_DIR } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const input = async (date = "2026-11-03") => {
  const p = await parseHealthDir(FIXTURE_DIR);
  return { insurers: p.insurers, products: p.products, categoryTitles: p.categoryTitles, sourceFile: "fixture", sourceDate: date, fileHash: p.fileHash, report: p.report };
};

d("health store", () => {
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 3 });
    await migrate(db);
  });
  afterAll(async () => {
    await db.pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.close();
  });

  it("refuses to read before any load", async () => {
    await expect(new HealthStore(db).data()).rejects.toBeInstanceOf(NoHealthLoad);
  });

  it("loads, reads back everything as published, and replaces on a second load", async () => {
    await loadHealth(db, await input());
    const data = await new HealthStore(db, 0).data();
    expect(data.products.length).toBe(6);
    const gold = data.products.find((p) => p.id === "tst-gold")!;
    expect(gold.premiums).toEqual([{ amountCents: 20000, frequency: "monthly", basis: "before_rebate" }]);
    expect(categoriesOf(data, gold).map((c) => `${c.code}:${c.cover}`)).toEqual([
      "PregnancyBirth:covered",
      "JointReconstructions:covered",
      "PsychiatricServices:restricted",
    ]);
    expect(gold.waiting).toEqual([
      { type: "PreExisting", months: 12 },
      { type: "PregnancyBirth", months: 12 },
    ]);
    expect(data.products.find((p) => p.id === "tst-couple")!.excessCents).toBeUndefined();
    expect(data.products.find((p) => p.id === "tst-rst-family")).toMatchObject({ household: "family", corporate: true, excessCents: 0 });
    expect(data.insurers.find((i) => i.id === "rst")).toMatchObject({ fundType: "restricted", restrictionHint: "Employees of the test union" });
    expect(data.sourceDate.toISOString().slice(0, 10)).toBe("2026-11-03");
    await loadHealth(db, await input("2026-12-03"));
    const again = await new HealthStore(db, 0).data();
    expect(again.products.length).toBe(6);
    expect(again.sourceDate.toISOString().slice(0, 10)).toBe("2026-12-03");
  });

  it("keeps the old rows when a load fails, and refuses an empty list", async () => {
    const bad = await input();
    bad.products = [...bad.products, { ...bad.products[0]! }]; // duplicate primary key
    await expect(loadHealth(db, bad)).rejects.toThrow();
    expect((await new HealthStore(db, 0).data()).products.length).toBe(6);
    await expect(loadHealth(db, { ...(await input()), products: [] })).rejects.toThrow(/empty/);
    const c = new pg.Pool({ connectionString: URL });
    const n = await c.query(`SELECT count(*)::int AS n FROM ${schema}.health_loads`);
    expect(n.rows[0].n).toBe(2);
    await c.end();
  });
});
