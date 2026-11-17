/** Health store against a real PostgreSQL (TEST_DATABASE_URL), in a throwaway schema. */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { hashFiles, HealthStore, loadHealth, NoHealthLoad } from "../../src/health/load.js";
import { parseHealthFiles } from "../../src/health/parse.js";
import { fixtureXml } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const input = (date = "2026-11-03") => {
  const files = fixtureXml();
  const p = parseHealthFiles(files);
  return { insurers: p.insurers, products: p.products, sourceFile: "fixture", sourceDate: date, fileHash: hashFiles(files), report: p.report };
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
    await loadHealth(db, input());
    const data = await new HealthStore(db, 0).data();
    expect(data.products.length).toBe(5);
    const gold = data.products.find((p) => p.code === "TST-GOLD")!;
    expect(gold.premiums).toEqual([{ amountCents: 20000, frequency: "monthly", basis: "before_rebate" }]);
    expect(gold.categories.length).toBe(3);
    expect(gold.waiting).toEqual([{ type: "Pregnancy", months: 12 }]);
    expect(data.products.find((p) => p.code === "TST-NOBASIS")!.excessCents).toBeUndefined();
    expect(data.sourceDate.toISOString().slice(0, 10)).toBe("2026-11-03");
    await loadHealth(db, input("2026-12-03"));
    const again = await new HealthStore(db, 0).data();
    expect(again.products.length).toBe(5);
    expect(again.sourceDate.toISOString().slice(0, 10)).toBe("2026-12-03");
  });

  it("keeps the old rows when a load fails, and refuses an empty list", async () => {
    const bad = input();
    bad.products = [...bad.products, { ...bad.products[0]! }]; // duplicate primary key
    await expect(loadHealth(db, bad)).rejects.toThrow();
    expect((await new HealthStore(db, 0).data()).products.length).toBe(5);
    await expect(loadHealth(db, { ...input(), products: [] })).rejects.toThrow(/empty/);
    const c = new pg.Pool({ connectionString: URL });
    const n = await c.query(`SELECT count(*)::int AS n FROM ${schema}.health_loads`);
    expect(n.rows[0].n).toBe(2);
    await c.end();
  });
});
