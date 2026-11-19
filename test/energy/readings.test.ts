/**
 * The interval readings note (add-energy-readings-prompt): the distributor matcher, the wording checks, the
 * consistency check against the distributors on active plans, and the note in compare_energy_plans.
 * Database parts need TEST_DATABASE_URL and run in a throwaway schema.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearReadinessChecks } from "../../src/core/readiness.js";
import { clearDataSets } from "../../src/core/registry.js";
import { loadBenchmarks } from "../../src/energy/benchmarks/load.js";
import { parseBenchmarkFile } from "../../src/energy/benchmarks/parse.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { startEnergy, type EnergyRuntime } from "../../src/energy/index.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { DISTRIBUTORS, matchDistributor, readingsNote, readingsWordingProblems, type Distributor } from "../../src/energy/readings.js";
import { runSync } from "../../src/energy/sync.js";
import { createServer } from "../../src/server/create-server.js";
import { serverInstructions } from "../../src/server/instructions.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const BENCH = `${process.cwd()}/test/fixtures/benchmarks/aer_benchmarks_synthetic.xlsx`;

const L: Distributor[] = [
  { name: "Ausgrid", aliases: [], requestUrl: "https://example.test/ausgrid", checkedAt: "2026-11-19", note: "Its page says it takes 10 business days and a fee may apply after 4 requests." },
  { name: "Citipower", aliases: ["CitiPower"], none: "portal did not answer" },
];

describe("distributor matcher", () => {
  it("matches a name, an alias, and ignores case and punctuation", () => {
    expect(matchDistributor("Ausgrid", L)?.name).toBe("Ausgrid");
    expect(matchDistributor("CITIPOWER", L)?.name).toBe("Citipower");
    expect(matchDistributor("Citi-Power", L)?.name).toBe("Citipower");
    expect(matchDistributor("AusNet Services", DISTRIBUTORS)?.name).toBe("AusNet Services (electricity)");
    expect(matchDistributor("Essential Energy Far West", DISTRIBUTORS)?.name).toBe("Essential Energy");
  });
  it("returns nothing for an unknown or missing name", () => {
    expect(matchDistributor("Nowhere Networks", L)).toBeUndefined();
    expect(matchDistributor(undefined, L)).toBeUndefined();
  });
});

describe("readingsNote", () => {
  it("links a checked distributor page and repeats only its own note", () => {
    const n = readingsNote("Ausgrid", L);
    expect(n.distributor).toMatchObject({ name: "Ausgrid", url: "https://example.test/ausgrid", checkedAt: "2026-11-19" });
    expect(n.text).toContain("[its meter data request page](https://example.test/ausgrid)");
    expect(n.text).toContain("Its page says it takes 10 business days");
    expect(readingsWordingProblems(n)).toEqual([]);
  });
  it("stays generic, with no link and no claim, for a distributor with no checked page or no match", () => {
    for (const name of ["Citipower", "Nowhere Networks", undefined]) {
      const n = readingsNote(name, L);
      expect(n.distributor).toBeUndefined();
      expect(n.text).not.toMatch(/https?:|\]\(/);
      expect(n.text).not.toMatch(/The distributor here is/);
      expect(readingsWordingProblems(n)).toEqual([]);
    }
  });
  it("never says your usage or your bill, and says Ask Righto does not handle the readings", () => {
    const t = readingsNote("Ausgrid", L).text;
    expect(t).not.toMatch(/your usage|your bill/i);
    expect(t).toMatch(/does not request the readings\. Once the household has the file/);
    expect(t).toMatch(/NMI/);
  });
});

describe("wording check", () => {
  const bad = (text: string) => readingsWordingProblems({ text, short: "x" });
  it("fails an unsourced fee, time or handling claim", () => {
    expect(bad("It is free and arrives in 5 days.")).toEqual(expect.arrayContaining(["states a fee or cost without a source", "states a time without a source"]));
    expect(bad("Distributors take within 10 business days.")).toContain("states a time without a source");
    expect(bad("We will request the readings for you.")).toContain("implies Ask Righto handles the readings");
    expect(bad("Upload the file here.")).toContain("implies Ask Righto handles the readings");
    expect(bad("There is no cost.")).toContain("states a fee or cost without a source");
  });
  it("accepts a fee or time only inside the distributor's own note", () => {
    const note = "Its page says 10 business days and a fee may apply.";
    expect(readingsWordingProblems({ text: `Ask your distributor. ${note}`, short: "x", distributor: { name: "A", url: "https://a.test/", checkedAt: "2026-11-19", note } })).toEqual([]);
    expect(readingsWordingProblems({ text: `Ask your distributor, it is free. ${note}`, short: "x", distributor: { name: "A", url: "https://a.test/", checkedAt: "2026-11-19", note } })).toContain("states a fee or cost without a source");
  });
});

describe("distributors.json consistency", () => {
  it("has exactly one of a checked request page or a reason for each entry", () => {
    for (const x of DISTRIBUTORS) {
      expect(!!x.requestUrl !== !!x.none, `${x.name}: needs exactly one of requestUrl or none`).toBe(true);
      if (x.requestUrl) {
        expect(x.requestUrl, x.name).toMatch(/^https:\/\//);
        expect(x.checkedAt, x.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(x.note, `${x.name}: a note needs a checked page`).toBeUndefined();
        expect(x.none!.length).toBeGreaterThan(8);
      }
    }
  });
  it("covers every electricity distributor named on active plans, or fails", () => {
    const seen = JSON.parse(readFileSync(`${process.cwd()}/test/fixtures/energy/distributors-on-active-plans.json`, "utf8")).names as string[];
    for (const n of seen) expect(matchDistributor(n), `${n} has no entry in distributors.json`).toBeDefined();
  });
  it("every shipped note passes the wording check", () => {
    for (const x of DISTRIBUTORS) expect(readingsWordingProblems(readingsNote(x.name)), x.name).toEqual([]);
  });
});

describe("guidance", () => {
  it("is in the server instructions", () => {
    const t = serverInstructions();
    expect(t).toMatch(/More accurate comparison/);
    expect(t).toMatch(/does not request the readings/);
  });
  it("is in the energy bill skill", () => {
    const s = readFileSync(`${process.cwd()}/plugin/skills/energy-bill-comparison/SKILL.md`, "utf8");
    expect(s).toMatch(/Interval readings/);
    expect(s).toMatch(/does not request the readings/);
  });
});

d("the note in compare_energy_plans (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  async function call(args: Record<string, unknown>) {
    const r = await client.callTool({ name: "compare_energy_plans", arguments: args });
    const text = (r.content as Array<{ text: string }>)[0]!.text;
    const sc = r.structuredContent as any;
    return { text, sc, g: sc.grounded ?? sc };
  }
  const plan = (name: string, planId: string) => ({ detail: { ...fixture(name), planId } });
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    // single-rate: CitiPower 3000; time-of-use: Jemena 3000; solar-time-varying: Ausgrid 2000.
    mock = await startMockCdr({ retailers: { agl: [plan("single-rate", "A1"), plan("solar-time-varying", "A3")], origin: [plan("time-of-use", "O1")], energyaustralia: [plan("block-rates-gas", "G1")] } });
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
    await loadBenchmarks(db, { ...(await parseBenchmarkFile(BENCH)), sourceFile: "synthetic.xlsx", sourceDate: "2021-06-01", releaseLabel: "Published December 2020, updated June 2021 for postcodes" });
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

  it("benchmark usage: the note once, below the table, with the matched distributor's checked page", async () => {
    const { g, text } = await call({ postcode: "2000", fuelType: "ELECTRICITY", useBenchmarkUsage: true, householdSize: 2 });
    expect(g.found).toBe(true);
    expect(g.data.readingsNote.distributor).toMatchObject({ name: "Ausgrid", url: expect.stringMatching(/ausgrid\.com\.au/) });
    expect(text.match(/More accurate comparison\./g)).toHaveLength(1);
    expect(text.indexOf("More accurate comparison.")).toBeGreaterThan(text.indexOf("| # |"));
    expect(text).toContain("[its meter data request page](https://www.ausgrid.com.au/");
    expect(text).not.toMatch(/your usage|your bill/i);
    expect(readingsWordingProblems(g.data.readingsNote)).toEqual([]);
  });

  it("single bill: the same note; a stated yearly figure or gas: none", async () => {
    const bill = await call({ postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", billUsageKwh: 900, billDays: 90 });
    expect(bill.g.data.readingsNote).toBeDefined();
    expect(bill.text.match(/More accurate comparison\./g)).toHaveLength(1);
    const yearly = await call({ postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", annualUsageKwh: 4000 });
    expect(yearly.g.data.readingsNote).toBeUndefined();
    expect(yearly.text).not.toMatch(/More accurate comparison/);
    const gas = await call({ postcode: "3000", fuelType: "GAS", useBenchmarkUsage: true, householdSize: 2 });
    expect(gas.g.found).toBe(true);
    expect(gas.g.data.readingsNote).toBeUndefined();
  });

  it("a distributor with no checked page gets the generic note and no link", async () => {
    const { g, text } = await call({ postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", useBenchmarkUsage: true, householdSize: 3 });
    expect(g.data.readingsNote.distributor).toBeUndefined();
    const section = text.slice(text.indexOf("More accurate comparison."));
    expect(section.split("\n")[0]).not.toMatch(/\]\(/);
    expect(section.split("\n")[0]).not.toMatch(/The distributor here is/);
  });

  it("a time-of-use plan not estimated says readings would allow a comparison", async () => {
    const { g } = await call({ postcode: "3000", fuelType: "ELECTRICITY", distributor: "Jemena", billUsageKwh: 900, billDays: 90 });
    const tou = g.data.notEstimated.find((x: any) => x.reason === "needs_time_of_use_split");
    expect(tou.detail).toMatch(/Interval readings from the retailer or distributor would allow it to be compared/);
    const bench = await call({ postcode: "3000", fuelType: "ELECTRICITY", distributor: "Jemena", useBenchmarkUsage: true, householdSize: 2 });
    expect(bench.g.data.notEstimated.find((x: any) => x.reason === "needs_time_of_use_split").detail).toMatch(/Interval readings from the retailer or distributor/);
  });

  it("the Inkview table carries the note (the caption is capped at 300 characters, so it rides in a footnote)", async () => {
    const { sc } = await call({ postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", billUsageKwh: 900, billDays: 90 });
    expect(sc.component).toBe("data_table");
    expect(JSON.stringify(sc)).toContain("footnote");
  });

});
