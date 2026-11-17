/** Career store against a real PostgreSQL (TEST_DATABASE_URL), in a throwaway schema. */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { CareerStore, loadCareers, NoCareerLoad } from "../../src/careers/load.js";
import { parseProjectionsFile } from "../../src/careers/parse.js";
import { FIXTURE } from "./helpers.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
let db: Db;
const input = async (date = "2025-11-06") => {
  const p = await parseProjectionsFile(FIXTURE);
  return { ...p, sourceFile: "fixture", sourceDate: date };
};

d("career store", () => {
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 3 });
    await migrate(db);
  });
  afterAll(async () => {
    await db.pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.close();
  });

  it("refuses to read before any load", async () => {
    await expect(new CareerStore(db).data()).rejects.toBeInstanceOf(NoCareerLoad);
  });

  it("loads, reads back as published (nulls stay missing), and replaces on a second load", async () => {
    await loadCareers(db, await input());
    const data = await new CareerStore(db, 0).data();
    expect(data.occupations.length).toBe(8);
    expect(data.occupations.find((o) => o.code === "8996")!.baselineK).toBeUndefined();
    expect(data.occupations.find((o) => o.code === "2411")!.change10Pct).toBeCloseTo(0.2015);
    expect(data.baselineLabel).toBe("May 2025");
    await loadCareers(db, await input("2026-11-30"));
    const again = await new CareerStore(db, 0).data();
    expect(again.occupations.length).toBe(8);
    expect(again.sourceDate.toISOString().slice(0, 10)).toBe("2026-11-30");
  });

  it("keeps the old rows when a load fails", async () => {
    const bad = await input();
    bad.occupations = [...bad.occupations, bad.occupations[0]!];
    await expect(loadCareers(db, bad)).rejects.toThrow();
    expect((await new CareerStore(db, 0).data()).occupations.length).toBe(8);
  });

  it("refuses an empty list", async () => {
    const e = await input();
    e.occupations = [];
    await expect(loadCareers(db, e)).rejects.toThrow(/empty/);
  });
});
