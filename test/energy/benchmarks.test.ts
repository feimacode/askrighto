/**
 * AER benchmarks: parser, lookup, loader and the compare_energy_plans benchmark scenarios.
 * The fixture is synthetic (invented numbers in the AER workbook's layout, see test/fixtures/benchmarks/make-fixture.mjs).
 * Database parts need TEST_DATABASE_URL, like db.test.ts, and run in a throwaway schema.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import readExcelFile from "read-excel-file/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearReadinessChecks } from "../../src/core/readiness.js";
import { clearDataSets } from "../../src/core/registry.js";
import { BenchmarkStore, loadBenchmarks, NoBenchmarkLoad } from "../../src/energy/benchmarks/load.js";
import { lookupBenchmark } from "../../src/energy/benchmarks/lookup.js";
import { parseBenchmarkFile, parseBenchmarkSheets } from "../../src/energy/benchmarks/parse.js";
import { stateOfPostcode } from "../../src/energy/benchmarks/state.js";
import type { BenchmarkData } from "../../src/energy/benchmarks/types.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { startEnergy, type EnergyRuntime } from "../../src/energy/index.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { runSync } from "../../src/energy/sync.js";
import { serverInstructions } from "../../src/server/instructions.js";
import { createServer } from "../../src/server/create-server.js";
import { NOTICE } from "../../src/tools/energy-common.js";
import { journeyBody } from "../../src/guidance/energy/index.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const FIXTURE = `${process.cwd()}/test/fixtures/benchmarks/aer_benchmarks_synthetic.xlsx`;
const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

async function fixtureData(): Promise<BenchmarkData> {
  const r = await parseBenchmarkFile(FIXTURE);
  return { rows: r.rows, postcodes: r.postcodes, sourceFile: "synthetic", sourceDate: new Date("2021-06-01T00:00:00Z"), releaseLabel: "Published December 2020, updated June 2021 for postcodes", loadedAt: new Date() };
}
type Sheet = { sheet: string; data: any[][] };
const rawSheets = async () => (await readExcelFile(readFileSync(FIXTURE))) as Sheet[];

describe("benchmark workbook parser", () => {
  it("reads every sheet as published and passes validation", async () => {
    const r = await parseBenchmarkFile(FIXTURE);
    expect(r.report.problems).toEqual([]);
    // 8 zone sheets (20 + 40 + 20 + 60 + 60 + 60 + 80 + 80), 6 gas sheets of 20, 10 SA zones x 20
    expect(r.report.benchmarkRows).toBe(420 + 120 + 200);
    expect(r.report.sheetRows["SA zones"]).toBe(200);
    expect(r.report.postcodeRows).toBe(12);
    expect(r.report.saPostcodes).toBe(2);
    expect(r.report.zone8EqualsZone7).toBe(true);
    expect(r.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps values and household size 5+ as published", async () => {
    const r = await parseBenchmarkFile(FIXTURE);
    const row = r.rows.find((x) => x.fuel === "ELECTRICITY" && x.zone === "2" && x.state === "QLD" && x.size === 2 && x.season === "Autumn")!;
    expect(row).toMatchObject({ value: 2321.5, unit: "kWh", sheet: "Climate zone 2" });
    expect(r.rows.some((x) => x.fuel === "GAS" && x.size === 5 && x.unit === "MJ")).toBe(true);
  });

  it("reports postcodes with no zone, duplicates, bad values and incomplete groups", async () => {
    const s = await rawSheets();
    const z1 = s.find((x) => x.sheet === "Climate zone 1")!;
    z1.data[8]![4] = 0; // not positive
    z1.data[9]![4] = "n/a"; // not a number
    z1.data.splice(11, 1); // incomplete group
    z1.data.push([null, "Autumn", "QLD", 1, 5]); // duplicate key
    const pm = s.find((x) => x.sheet === "Postcode mapping")!;
    pm.data[6]![2] = 9; // zone 9 has no sheet
    const r = parseBenchmarkSheets(s);
    expect(r.report.nonPositiveValues.length).toBe(1);
    expect(r.report.duplicateKeys.length).toBeGreaterThan(0);
    expect(r.report.incompleteGroups.length).toBeGreaterThan(0);
    expect(r.report.postcodesWithoutZone.join(" ")).toMatch(/2000/);
    expect(r.report.problems.length).toBeGreaterThanOrEqual(4);
  });

  it("fails when a sheet is missing", async () => {
    const s = (await rawSheets()).filter((x) => x.sheet !== "SA zones" && x.sheet !== "VIC");
    const r = parseBenchmarkSheets(s);
    expect(r.report.problems.join(" ")).toMatch(/SA zones/);
    expect(r.report.problems.join(" ")).toMatch(/gas benchmarks for VIC/);
  });
});

describe("postcode to state", () => {
  it("maps ranges, with 2618 treated as NSW", () => {
    expect(["2600", "2617", "2618", "2900", "3000", "4000", "5000", "6000", "7000", "0800", "0200", "8000", "2999"].map(stateOfPostcode)).toEqual(
      ["ACT", "ACT", "NSW", "ACT", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT", "VIC", "NSW"],
    );
    expect(stateOfPostcode("12")).toBeUndefined();
  });
});

describe("benchmark lookup", () => {
  const q = async (postcode: string, fuel: "ELECTRICITY" | "GAS", householdSize: number) => lookupBenchmark(await fixtureData(), { postcode, fuel, householdSize });

  it("returns four seasons, their sum, unit, zone, source and date for a QLD postcode", async () => {
    const r = await q("4000", "ELECTRICITY", 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.figure.seasons).toEqual({ Summer: 2320.5, Autumn: 2321.5, Winter: 2322.5, Spring: 2323.5 });
    expect(r.figure.annual).toBe(9288);
    expect(r.figure).toMatchObject({ unit: "kWh", zone: "2", zoneLabel: "climate zone 2", state: "QLD", householdSize: 2, sourceSheet: "Climate zone 2" });
    expect(r.figure.source.url).toMatch(/aer\.gov\.au/);
    expect(r.figure.releaseLabel).toMatch(/December 2020/);
    expect(r.figure.attribution).toMatch(/AER/);
  });

  it("uses the postcode's own state in a zone sheet shared by states", async () => {
    // Zone 4 holds NSW, SA and VIC; NSW 2800 and VIC 3550 must each get their own rows.
    const nsw = await q("2800", "ELECTRICITY", 1);
    const vic = await q("3550", "ELECTRICITY", 1);
    expect(nsw.ok && nsw.figure.seasons.Summer).toBe(4000 + 200 + 10 + 0.5);
    expect(vic.ok && vic.figure.seasons.Summer).toBe(4000 + 600 + 10 + 0.5);
    // 2618 is on the border but maps to zone 6 (NSW, SA, VIC): treated as NSW.
    const border = await q("2618", "ELECTRICITY", 1);
    expect(border.ok && border.figure.state).toBe("NSW");
  });

  it("uses the South Australian zone benchmarks for SA electricity", async () => {
    const adelaide = await q("5000", "ELECTRICITY", 4);
    expect(adelaide.ok).toBe(true);
    if (!adelaide.ok) return;
    expect(adelaide.figure).toMatchObject({ zoneKind: "sa_zone", zone: "Adelaide & Environs", sourceSheet: "SA zones" });
    expect(adelaide.figure.seasons.Summer).toBe(500 + 0 + 40 + 0 + 0.75);
    expect(adelaide.figure.annual).toBe(4 * 540 + 6 + 3);
    // Not the climate zone 4 row for the same postcode.
    const zone4 = (await fixtureData()).rows.find((x) => x.zone === "4" && x.state === "SA" && x.size === 4 && x.season === "Summer")!;
    expect(adelaide.figure.seasons.Summer).not.toBe(zone4.value);
    const farNorth = await q("5700", "ELECTRICITY", 5);
    expect(farNorth.ok && farNorth.figure).toMatchObject({ zone: "Far North", fiveOrMore: true });
  });

  it("uses the state sheet for gas, with TAS and ACT on their own sheets", async () => {
    const vic = await q("3000", "GAS", 2);
    expect(vic.ok && vic.figure).toMatchObject({ unit: "MJ", zoneKind: "gas_state", zone: "VIC", annual: 64861 });
    const tas = await q("7000", "GAS", 1);
    expect(tas.ok && tas.figure.zone).toBe("TAS");
  });

  it("returns outside_coverage for WA, NT, unmapped postcodes and size out of range", async () => {
    for (const pc of ["6000", "0800", "2001"]) {
      expect(await q(pc, "ELECTRICITY", 2)).toMatchObject({ ok: false, reason: "outside_coverage" });
    }
    expect(await q("6000", "GAS", 2)).toMatchObject({ ok: false, reason: "outside_coverage" });
    expect(await q("3000", "ELECTRICITY", 6)).toMatchObject({ ok: false });
  });

  it("returns pooled cells as published, with no adjustment", async () => {
    const data = await fixtureData();
    const two = data.rows.filter((r) => r.fuel === "GAS" && r.zone === "NSW" && r.size === 2);
    for (const r of data.rows.filter((r) => r.fuel === "GAS" && r.zone === "NSW" && r.size === 3)) r.value = two.find((x) => x.season === r.season)!.value;
    const a = lookupBenchmark(data, { postcode: "2000", fuel: "GAS", householdSize: 2 });
    const b = lookupBenchmark(data, { postcode: "2000", fuel: "GAS", householdSize: 3 });
    expect(a.ok && b.ok && a.figure.annual === b.figure.annual && a.figure.seasons.Winter === b.figure.seasons.Winter).toBe(true);
  });
});

d("benchmark loader (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 3 });
    await migrate(db);
  });
  afterAll(async () => {
    await db.pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.close();
  });
  const input = async () => ({ ...(await parseBenchmarkFile(FIXTURE)), sourceFile: "synthetic.xlsx", sourceDate: "2021-06-01", releaseLabel: "Published December 2020, updated June 2021 for postcodes" });

  it("refuses to read before any load", async () => {
    await expect(new BenchmarkStore(db, 0).data()).rejects.toBeInstanceOf(NoBenchmarkLoad);
  });

  it("loads every row with file name and hash, and a second load replaces rather than adds", async () => {
    const i = await input();
    expect(await loadBenchmarks(db, i)).toEqual({ rows: 740, postcodes: 12 });
    expect(await loadBenchmarks(db, i)).toEqual({ rows: 740, postcodes: 12 });
    const data = await new BenchmarkStore(db, 0).data();
    expect(data.rows.length).toBe(740);
    expect(data.postcodes.length).toBe(12);
    expect(data.sourceFile).toBe("synthetic.xlsx");
    expect(data.sourceDate.toISOString().slice(0, 10)).toBe("2021-06-01");
    const load = (await db.pool.query("SELECT file_hash, benchmark_rows, postcode_rows FROM energy_benchmark_load ORDER BY id DESC LIMIT 1")).rows[0];
    expect(load).toMatchObject({ file_hash: i.fileHash, benchmark_rows: 740, postcode_rows: 12 });
    // Full precision survives the round trip.
    expect(data.rows.find((r) => r.zone === "2" && r.state === "QLD" && r.size === 2 && r.season === "Autumn")!.value).toBe(2321.5);
    // And the DB-backed data answers the same lookup as the parsed file.
    const r = lookupBenchmark(data, { postcode: "5000", fuel: "ELECTRICITY", householdSize: 4 });
    expect(r.ok && r.figure.annual).toBe(2169);
  });

  it("keeps the old rows when a load fails part-way", async () => {
    const bad = await input();
    bad.rows = [...bad.rows, bad.rows[0]!]; // duplicate primary key
    await expect(loadBenchmarks(db, bad)).rejects.toThrow();
    const data = await new BenchmarkStore(db, 0).data();
    expect(data.rows.length).toBe(740);
    expect(data.postcodes.length).toBe(12);
  });

  it("refuses an empty load", async () => {
    const e = await input();
    await expect(loadBenchmarks(db, { ...e, rows: [] })).rejects.toThrow(/empty/);
  });
});

d("compare_energy_plans with typical usage", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  const plan = (name: string, planId: string) => ({ detail: { ...fixture(name), planId } });

  async function call(args: Record<string, unknown>) {
    const r = await client.callTool({ name: "compare_energy_plans", arguments: args });
    const text = (r.content as Array<{ text: string }>)[0]!.text;
    const sc = r.structuredContent as any;
    return { text, sc, g: sc.grounded ?? sc };
  }
  const base = { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", distributor: "CitiPower" };

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    mock = await startMockCdr({
      retailers: {
        agl: [plan("single-rate", "A1"), plan("unknown-model", "A2")],
        origin: [plan("time-of-use", "O1")],
        energyaustralia: [plan("block-rates-gas", "G1")],
      },
    });
    clearDataSets();
    clearReadinessChecks();
    rt = (await startEnergy({ DATABASE_URL: URL, DATABASE_SCHEMA: schema, ASKRIGHTO_SYNC_SCHEDULE: "off" } as NodeJS.ProcessEnv))!;
    await runSync({
      db,
      gstBasis: "EXCLUSIVE",
      client: new CdrClient({ baseUrl: mock.url, limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }) }),
      retailers: [
        { slug: "agl", brandName: "AGL", active: true },
        { slug: "origin", brandName: "Origin Energy", active: true },
        { slug: "energyaustralia", brandName: "EnergyAustralia", active: true },
      ],
    });
    rt.store.clear();
    await rt.refresh();
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer().connect(a);
    client = new Client({ name: "test", version: "1" });
    await client.connect(b);
  });
  afterAll(async () => {
    await client.close();
    await mock.close();
    clearDataSets();
    clearReadinessChecks();
    await rt.stop().catch(() => undefined);
    const admin = new pg.Pool({ connectionString: URL });
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  it("says typical usage is unavailable (and makes no estimate) before benchmarks are loaded", async () => {
    const { g } = await call({ ...base, usageSource: "typical", householdSize: 3 });
    expect(g).toMatchObject({ found: false, reason: "data_unavailable" });
    expect(g.message).toMatch(/not been loaded/);
  });

  it("loads the fixture benchmarks", async () => {
    await loadBenchmarks(db, { ...(await parseBenchmarkFile(FIXTURE)), sourceFile: "synthetic.xlsx", sourceDate: "2021-06-01", releaseLabel: "Published December 2020, updated June 2021 for postcodes" });
    rt.benchmarks.clear?.();
  });

  it("asks for usage when a bill source has none", async () => {
    const { g } = await call({ ...base, usageSource: "bill" });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/`usage`/);
  });

  it("asks for the household size when typical usage is requested without it", async () => {
    const { g } = await call({ ...base, usageSource: "typical" });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/householdSize/);
    expect(g.message).toMatch(/how many people/);
  });

  it("gives no baseline for a time-of-use current plan under typical usage, and still ranks the plans", async () => {
    const { g, text } = await call({ ...base, distributor: "Jemena", usageSource: "typical", householdSize: 3, currentPlanId: "O1" });
    expect(g.found).toBe(true);
    expect(g.data.current).toMatchObject({ costed: false, reason: "not_estimated", planId: "O1" });
    expect(g.data.current.detail).toMatch(/needs_time_of_use_split/);
    expect(g.data.counts.current).toBe(0);
    for (const e of g.data.estimates) expect(e.differenceFromCurrentCents).toBeUndefined();
    expect(text).toMatch(/Your current plan: The current plan Origin Energy .* could not be costed/);
  });

  it("estimates from the benchmark annual figure, labelled typical, with the notice above the table", async () => {
    const { g, text } = await call({ ...base, usageSource: "typical", householdSize: 3 });
    expect(g.found).toBe(true);
    // VIC postcode 3000 is climate zone 6: 6000 + 600 + 30 = 6630 per season (+ 0.5 + season index), sum 26528.
    expect(g.data.usage).toMatchObject({ basis: "benchmark", annualUsage: 26528, unit: "kWh" });
    expect(g.data.usage.benchmark).toMatchObject({ zone: "6", state: "VIC", householdSize: 3, annual: 26528, seasons: { summer: 6630.5, autumn: 6631.5, winter: 6632.5, spring: 6633.5 } });
    expect(g.data.usage.benchmark.source.url).toMatch(/aer\.gov\.au/);
    expect(g.data.usage.benchmark.release).toMatch(/December 2020/);
    expect(g.data.typicalUsageNotice).toMatch(/Typical usage for a household of 3 in climate zone 6/);
    expect(g.data.typicalUsageNotice).toMatch(/not your own/);
    // The notice leads the text and precedes the table; the figure is never called the person's usage or bill.
    expect(text.indexOf("Typical usage for a household of 3")).toBe(0);
    expect(text.indexOf("Typical usage for a household of 3")).toBeLessThan(text.indexOf("| # |"));
    expect(text).not.toMatch(/your usage|your bill/i);
    expect(text).toMatch(/lowest estimate for typical usage/);
    expect(text).toContain(NOTICE);
    expect(g.source.attribution).toMatch(/AER/);
    expect(text).toContain(g.data.usage.benchmark.source.url);
    expect(text).toMatch(/Benchmark source: .*December 2020/);
    // Loaded after the server started: no "not loaded yet" warning.
    expect(JSON.stringify(g.warnings ?? [])).not.toMatch(/not been loaded/);
    // Same maths as stated usage: only the label differs.
    const own = (await call({ ...base, usageSource: "yearly", usage: 26528 })).g;
    expect(own.data.usage.basis).toBe("customer");
    expect(own.data.usage.benchmark).toBeUndefined();
    expect(own.data.typicalUsageNotice).toBeUndefined();
    expect(g.data.estimates.map((e: any) => e.totalCents)).toEqual(own.data.estimates.map((e: any) => e.totalCents));
  });

  it("lists solar export and controlled load as omissions, and time-of-use plans as not estimated", async () => {
    const { g, text } = await call({ postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", distributor: "Jemena", usageSource: "typical", householdSize: 2 });
    expect(g.found).toBe(true);
    expect(g.data.omissions.join(" ")).toMatch(/solar export and controlled load are not included/i);
    expect(g.data.notEstimated[0]).toMatchObject({ planId: "O1", reason: "needs_time_of_use_split" });
    expect(g.data.notEstimated[0].detail).toMatch(/peak, shoulder and off-peak split from a bill/);
    expect(text).toMatch(/Solar export and controlled load are not included/);
  });

  it("refuses bill-only figures mixed with typical usage", async () => {
    const { g } = await call({ ...base, usageSource: "typical", householdSize: 3, solarExportAnnualKwh: 100 });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("refuses the person's own usage mixed with typical usage, rather than letting one win", async () => {
    const { g } = await call({ ...base, usageSource: "typical", householdSize: 3, usage: 4000 });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/`usage` is not used with usageSource `typical`/);
    const own = await call({ ...base, usageSource: "yearly", usage: 4000 });
    expect(own.g.data.usage.basis).toBe("customer");
    expect(own.g.data.usage.annualUsage).toBe(4000);
    expect(own.g.data.typicalUsageNotice).toBeUndefined();
    expect(own.g.data.estimates[0].totalCents).toBe(167365);
    expect(own.text).not.toMatch(/Typical usage for a household/);
  });

  it("returns outside_coverage for a postcode outside the benchmark data and makes no estimate", async () => {
    const { g } = await call({ postcode: "6000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", usageSource: "typical", householdSize: 2 });
    expect(g).toMatchObject({ found: false, reason: "outside_coverage" });
    expect(g.message).toMatch(/Western Australia|Northern Territory/);
  });

  it("works for gas, in MJ, and carries the notice into the Inkview view", async () => {
    const { g, sc } = await call({ postcode: "3000", fuelType: "GAS", customerType: "RESIDENTIAL", usageSource: "typical", householdSize: 2 });
    expect(g.found).toBe(true);
    expect(g.data.usage).toMatchObject({ basis: "benchmark", unit: "MJ" });
    expect(JSON.stringify(sc)).toContain("Typical usage for a household of 2");
    // The Inkview table must actually render (its caption is capped at 300 characters) and lead with the typical-usage line.
    expect(sc.component).toBe("listings");
    expect(JSON.stringify(sc)).toMatch(/"caption":"Typical usage for a household of 2, not your own\. These figures/);
    // The worst case: the longest SA zone name and five or more people still fit.
    const worst = `Typical usage for a household of 5 or more, not your own. ${NOTICE}`;
    expect(worst.length).toBeLessThanOrEqual(300);
  });

  it("is in the server instructions", () => {
    const text = serverInstructions();
    expect(text).toMatch(/get_energy_guide/);
    expect(text).toMatch(/never assume usage or household size/i);
    // The steps live in the journey, served as a skill and by get_energy_guide.
    const steps = journeyBody("energy-compare");
    expect(steps).toMatch(/`typical`: only if the user has no bill/);
    expect(steps).toMatch(/householdSize/);
    expect(steps).toMatch(/not the user's own/);
  });
});
