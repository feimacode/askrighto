/**
 * list_current_plan_options (add-energy-invoice-first). Database parts need TEST_DATABASE_URL and run in a throwaway schema.
 */
import { randomBytes } from "node:crypto";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearReadinessChecks } from "../../src/core/readiness.js";
import { clearDataSets } from "../../src/core/registry.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { startEnergy, type EnergyRuntime } from "../../src/energy/index.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { runSync } from "../../src/energy/sync.js";
import { serverInstructions } from "../../src/server/instructions.js";
import { allTools } from "../../src/tools/index.js";
import { createServer } from "../../src/server/create-server.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

describe("invoice-first guidance", () => {
  it("asks for the invoice first, lists the fields, bans identifiers, and routes moving house to typical usage", () => {
    const t = serverInstructions();
    expect(t).toMatch(/latest invoice first/i);
    expect(t).toMatch(/show back for the user to confirm/i);
    expect(t).toMatch(/Never put the user's name, address, account number or NMI into any tool/);
    expect(t).toMatch(/moving house or moving in/);
    expect(t).toMatch(/list_current_plan_options/);
    expect(t).toMatch(/never match by plan name/i);
  });
});

describe("list_current_plan_options inputs", () => {
  it("takes no name, address, account number or meter identifier, and no long free text", () => {
    const tool = allTools.find((t) => t.name === "list_current_plan_options")!;
    const shape = tool.inputSchema.shape as Record<string, { _def: { typeName?: string }; maxLength?: number | null }>;
    expect(Object.keys(shape).sort()).toEqual(
      ["customerType", "distributor", "fuelType", "offPeakRatePerUnit", "peakRatePerUnit", "planCode", "planName", "postcode", "retailer", "shoulderRatePerUnit", "showAllOptions", "singleRatePerUnit", "supplyChargePerDay"].sort(),
    );
    // planName is the plan the user says they are on (a product name, not a person's name); it is short and only narrows the list.
    for (const k of Object.keys(shape).filter((x) => x !== "planName")) expect(k).not.toMatch(/name|address|account|nmi|meter|serial/i);
    expect(shape.planName!.maxLength ?? tool.inputSchema.shape.planName!.safeParse("x".repeat(500)).success === false).toBeTruthy();
    // The only strings are short: a postcode, a retailer and a network name.
    expect(() => tool.inputSchema.parse({ postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", retailer: "x".repeat(500) })).toThrow();
  });
});

d("list_current_plan_options (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  const plan = (name: string, planId: string) => ({ detail: { ...fixture(name), planId } });
  async function call(args: Record<string, unknown>) {
    const r = await client.callTool({ name: "list_current_plan_options", arguments: args });
    const sc = r.structuredContent as any;
    return { text: (r.content as Array<{ text: string }>)[0]!.text, g: sc.grounded ?? sc };
  }
  const base = { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", retailer: "Origin", showAllOptions: true };

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    // Origin: two time-of-use plans with identical rates and hours (Jemena) and one single rate plan (CitiPower).
    mock = await startMockCdr({ retailers: { origin: [plan("time-of-use", "O1"), plan("time-of-use", "O2"), { detail: { ...fixture("single-rate"), planId: "O3", brandName: "Origin Energy" } }] } });
    clearDataSets();
    clearReadinessChecks();
    rt = (await startEnergy({ DATABASE_URL: URL, DATABASE_SCHEMA: schema, ASKRIGHTO_SYNC_SCHEDULE: "off" } as NodeJS.ProcessEnv))!;
    await runSync({
      db,
      gstBasis: "EXCLUSIVE",
      client: new CdrClient({ baseUrl: mock.url, limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }) }),
      retailers: [{ slug: "origin", brandName: "Origin Energy", active: true }],
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

  it("asks which network when the postcode has several, before listing anything", async () => {
    const r = await call(base);
    expect(r.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(r.g.message).toMatch(/more than one distributor/);
    expect(r.g.details ?? r.g.data ?? r.g).toBeTruthy();
  });

  it("narrows by a plan name the user states, as words, and still leaves the pick to the user", async () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.showAllOptions;
    const r = await call({ ...rest, distributor: "Jemena", planName: "time of use plan" });
    expect(r.g.found).toBe(true);
    expect(r.g.data.narrowed).toBe(true);
    expect(r.g.data.options).toHaveLength(1);
    expect(r.g.data.options[0].planIds).toEqual(["O1", "O2"]);
    expect(r.g.data.options[0].matchedOn).toContain("words of the plan name you gave");
    expect(r.g.data.nextStep).toMatch(/ask the user to pick/);
    expect(r.text).toMatch(/Matched your invoice on: words of the plan name you gave/);
  });

  it("with no name match says so and offers the band-hour layouts", async () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.showAllOptions;
    const r = await call({ ...rest, distributor: "Jemena", planName: "Zebra Deluxe" });
    expect(r.g.found).toBe(true);
    expect(r.g.data.options).toHaveLength(0);
    expect(r.g.data.layouts.length).toBeGreaterThan(0);
    expect(r.g.data.nextStep).toMatch(/shares a word with the name given/);
  });

  it("uses a name only as a hint beside invoice figures, never to select", async () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.showAllOptions;
    const r = await call({ ...rest, distributor: "Jemena", planName: "Time of Use", supplyChargePerDay: 9.99 });
    expect(r.g.data.options).toHaveLength(0); // the figure agrees with nothing; the name does not rescue it
  });

  it("merges plans with identical rates and hours into one option, with plain-words rates and hours", async () => {
    const r = await call({ ...base, distributor: "Jemena" });
    expect(r.g.found).toBe(true);
    const o = r.g.data.options;
    expect(o).toHaveLength(1);
    expect(o[0].planIds).toEqual(["O1", "O2"]);
    expect(o[0].tariff).toBe("time of use");
    expect(o[0].hours).toMatch(/Peak .* on /);
    expect(o[0].supplyPerDayIncGst).toBe("$1.0450"); // 0.95 + GST
    expect(o[0].ratesIncGst).toEqual(expect.arrayContaining([expect.objectContaining({ band: "peak", perUnit: "$0.4950" })]));
    expect(r.g.data.layouts).toHaveLength(1);
    expect(r.text).toMatch(/none of these|If none of these/);
    expect(r.text).toContain("Amounts include GST");
    expect(r.g.source.url).toMatch(/aer\.gov\.au/);
  });

  it("says what matched the invoice, which always includes GST: stored rates plus 10 per cent", async () => {
    const hit = await call({ ...base, distributor: "Jemena", supplyChargePerDay: 1.045, peakRatePerUnit: 0.495 });
    expect(hit.g.data.options[0].matchedOn).toEqual(expect.arrayContaining(["daily supply charge", "peak rate"]));
    // The stored, GST exclusive figure is not what an invoice shows, so it does not match.
    // With figures given, only options that agree are listed: the stored, GST exclusive figure is not what an invoice shows, so nothing agrees.
    const excl = await call({ ...base, distributor: "Jemena", supplyChargePerDay: 0.95, peakRatePerUnit: 0.45 });
    expect(excl.g.data.options).toEqual([]);
    expect(excl.g.data.nextStep).toMatch(/Nothing in this retailer's list agrees/);
    const none = await call({ ...base, distributor: "Jemena", peakRatePerUnit: 0.99 });
    expect(none.g.data.options).toEqual([]);
    expect(none.g.data.layouts.length).toBeGreaterThan(0);
  });

  it("lists a single rate plan with no hours, and no layouts", async () => {
    const r = await call({ ...base, distributor: "CitiPower" });
    expect(r.g.data.options[0]).toMatchObject({ tariff: "single rate", planIds: ["O3"] });
    expect(r.g.data.options[0].hours).toBeUndefined();
    expect(r.g.data.layouts).toEqual([]);
  });

  it("lists only the customer type asked for", async () => {
    const r = await call({ ...base, distributor: "Jemena", customerType: "BUSINESS" });
    expect(r.g).toMatchObject({ found: false, reason: "outside_coverage" });
  });

  it("says plainly when the retailer is not in the data, and sends the user to the band hours", async () => {
    const r = await call({ ...base, retailer: "Zzyzx Power", distributor: "Jemena" });
    expect(r.g).toMatchObject({ found: false, reason: "not_in_dataset" });
    expect(r.g.message).toMatch(/band hours/);
  });

  it("rejects a bad postcode", async () => {
    expect((await call({ ...base, postcode: "30" })).g).toMatchObject({ found: false, reason: "needs_input" });
  });
});

describe("energy vertical serves the pick list", () => {
  it("lists list_current_plan_options on the public energy route", async () => {
    const { routeSet } = await import("../../src/verticals.js");
    const { energyVertical } = await import("../../src/energy/vertical.js");
    const names = routeSet([energyVertical], ["energy"]).tools.map((t) => t.name);
    expect(names).toContain("list_current_plan_options");
  });
});
