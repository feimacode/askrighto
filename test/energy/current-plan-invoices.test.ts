/**
 * Finding the household's current plan from an invoice, against RECORDED plan data (add-energy-invoice-first).
 *
 * The plans are the 30 Momentum Energy electricity plans on United Energy at postcode 3128 as the AER's CDR
 * product reference data gave them on 17 Nov 2026 (test/fixtures/energy/recorded/momentum-united-energy-3128.json;
 * public plan data, no personal data). Each case is one invoice: the retailer as printed, the network, and the
 * figures printed on it (which include GST), and what the lookup must return. To add an invoice, add a row to
 * INVOICES (figures only: never a name, address, account number or meter identifier).
 *
 * Database parts need TEST_DATABASE_URL and run in a throwaway schema.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
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
import { createServer } from "../../src/server/create-server.js";
import { startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const PLANS = JSON.parse(readFileSync("test/fixtures/energy/recorded/momentum-united-energy-3128.json", "utf8")) as Array<Record<string, any>>;

interface Invoice {
  /** What the case is, for the test name. */
  name: string;
  /** The retailer as printed on the invoice. */
  retailer: string;
  /** Figures printed on the invoice, GST included. */
  figures: Record<string, number | string>;
  /** A plan name the one option returned must list (the user recognises their plan by name; it is not used to match). */
  expectName: string;
  /** Plan ids the option's plan ids must include (only the first three of a group are listed). */
  expectIds?: string[];
  /** How many options are returned (default 1). */
  options?: number;
}

const BASE = { postcode: "3128", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", distributor: "United Energy" };

// Momentum "NAB Goodies" time of use: daily supply $1.0170 (1.1187 with GST); the usage rates are 4pm-9pm $0.324,
// 11am-4pm $0.139 and 9pm-11am $0.178 (0.3564, 0.1529 and 0.1958 with GST), every band labelled SHOULDER in the data.
// The figures in the first case are those Iven's invoice gave in the 20 Nov 2026 trial.
const INVOICES: Invoice[] = [
  { name: "NAB Goodies time of use: supply charge and the 9pm to 11am rate", retailer: "Momentum Energy", figures: { supplyChargePerDay: 1.1187, shoulderRatePerUnit: 0.1958 }, expectName: "NAB Goodies" },
  { name: "NAB Goodies time of use: invoice calls the three rates peak, shoulder and off-peak", retailer: "Momentum Energy", figures: { supplyChargePerDay: 1.1187, peakRatePerUnit: 0.3564, shoulderRatePerUnit: 0.1529, offPeakRatePerUnit: 0.1958 }, expectName: "NAB Goodies" },
  { name: "NAB Goodies time of use: only the dearest rate", retailer: "Momentum Energy", figures: { supplyChargePerDay: 1.1187, peakRatePerUnit: 0.3564 }, expectName: "NAB Goodies" },
  { name: "NAB Goodies single rate", retailer: "Momentum Energy", figures: { supplyChargePerDay: 1.1187, singleRatePerUnit: 0.242 }, expectName: "NAB Goodies" },
  { name: "the plan code printed on the invoice", retailer: "Momentum Energy", figures: { planCode: "MOM799922MR" }, expectName: "NAB Goodies", expectIds: ["MOM799922MR@VEC"] },
  { name: "the plan code in lower case with the suffix", retailer: "Momentum Energy", figures: { planCode: "mom799923mr@vec" }, expectName: "NAB Goodies", expectIds: ["MOM799923MR@VEC"] },
  { name: "Standing Offer: its own supply charge and rate", retailer: "Momentum Energy", figures: { supplyChargePerDay: 1.1912, singleRatePerUnit: 0.2735 }, expectName: "Standing Offer" },
  // Add more invoices here.
];

// How the retailer may be written on an invoice.
const RETAILER_NAMES = ["Momentum", "Momentum Energy", "momentum energy", "MOMENTUM ENERGY", "Momentum Energy Pty Ltd", "Momentum Enrgy"];

d("current plan from an invoice (recorded Momentum plans, 3128 United Energy)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  async function call(args: Record<string, unknown>) {
    const r = await client.callTool({ name: "list_current_plan_options", arguments: { ...BASE, ...args } });
    const g = ((r.structuredContent as any).grounded ?? r.structuredContent) as any;
    return { g, text: (r.content as Array<{ text: string }>)[0]!.text, sc: r.structuredContent };
  }

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    mock = await startMockCdr({ retailers: { momentum: PLANS.map((detail) => ({ detail })) } });
    clearDataSets();
    clearReadinessChecks();
    rt = (await startEnergy({ DATABASE_URL: URL, DATABASE_SCHEMA: schema, ASKRIGHTO_SYNC_SCHEDULE: "off" } as NodeJS.ProcessEnv))!;
    await runSync({
      db,
      gstBasis: "EXCLUSIVE",
      client: new CdrClient({ baseUrl: mock.url, limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }) }),
      retailers: [{ slug: "momentum", brandName: "Momentum Energy", active: true }],
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

  it("stores the recorded plans", async () => {
    const r = await call({ retailer: "Momentum", showAllOptions: true });
    expect(r.g.data.totalPlans).toBe(PLANS.length);
  });

  for (const inv of INVOICES) {
    it(`finds the plan: ${inv.name}`, async () => {
      const r = await call({ retailer: inv.retailer, ...inv.figures });
      expect(r.g.found).toBe(true);
      expect(r.g.data.tooMany).toBe(false);
      expect(r.g.data.options, JSON.stringify(r.g.data.options.map((o: any) => [o.planIds, o.matchedOn, o.notMatched]))).toHaveLength(inv.options ?? 1);
      const o = r.g.data.options[0];
      expect(o.planNames, inv.name).toContain(inv.expectName);
      for (const id of inv.expectIds ?? []) expect(o.planIds, id).toContain(id);
      // The user is asked to choose, and nothing is chosen for them.
      expect(r.g.data.nextStep).toMatch(/pick|choose/i);
    });
  }

  for (const name of RETAILER_NAMES) {
    it(`reads the retailer written as "${name}"`, async () => {
      const r = await call({ retailer: name, supplyChargePerDay: 1.1187, shoulderRatePerUnit: 0.1958 });
      expect(r.g.found, r.g.message).toBe(true);
      expect(r.g.data.retailer).toBe("Momentum Energy");
    });
  }

  it("says the retailer is not in the data when it has no plans here, and does not guess another", async () => {
    const r = await call({ retailer: "Origin Energy", supplyChargePerDay: 1.1187 });
    expect(r.g).toMatchObject({ found: false, reason: "not_in_dataset" });
  });

  it("does not list the other plans of the retailer for a figure that matches none of them", async () => {
    const r = await call({ retailer: "Momentum Energy", supplyChargePerDay: 0.5, shoulderRatePerUnit: 0.01 });
    expect(r.g.data.options).toEqual([]);
    expect(r.g.data.layouts.length).toBeGreaterThan(0);
  });

  it("when only the supply charge is given, lists the few that share it so the user can choose", async () => {
    const r = await call({ retailer: "Momentum Energy", supplyChargePerDay: 1.1187 });
    expect(r.g.data.tooMany).toBe(false);
    expect(r.g.data.options.length).toBeGreaterThan(1);
    expect(r.g.data.options.length).toBeLessThanOrEqual(4);
    const names = r.g.data.options.flatMap((o: any) => o.planNames);
    expect(names).toContain("NAB Goodies");
  });

  it("shows each band of the NAB Goodies time of use plan with its own hours and rate", async () => {
    const r = await call({ retailer: "Momentum Energy", planCode: "MOM799922MR" });
    const rates = r.g.data.options[0].ratesIncGst as Array<{ band: string; hours?: string; perUnit: string }>;
    expect(rates.map((x) => x.perUnit).sort()).toEqual(["$0.1529", "$0.1958", "$0.3564"]);
    expect(rates.find((x) => x.perUnit === "$0.3564")!.hours).toMatch(/4pm to 9pm/);
    expect(rates.find((x) => x.perUnit === "$0.1529")!.hours).toMatch(/11am to 4pm/);
  });
});
