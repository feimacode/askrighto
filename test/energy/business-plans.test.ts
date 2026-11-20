/**
 * Business and residential plans are stored together and never mixed in a result (add-energy-business-plans).
 * Database parts need TEST_DATABASE_URL and run in a throwaway schema.
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
import { plansByPostcode } from "../../src/energy/store.js";
import { runSync } from "../../src/energy/sync.js";
import { serverInstructions } from "../../src/server/instructions.js";
import { createServer } from "../../src/server/create-server.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

describe("business plans in the guidance", () => {
  it("tells the host to ask whether the plans are for a home or a business, and not to assume", () => {
    const t = serverInstructions();
    expect(t).toMatch(/home or a business/i);
    expect(t).toMatch(/customerType/);
    expect(t).toMatch(/never assume|do not assume/i);
    expect(t).toMatch(/no typical usage for a business|typical usage is for households only/i);
  });
});

d("business and residential plans (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  const plan = (name: string, planId: string) => ({ detail: { ...fixture(name), planId } });
  async function call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args });
    const sc = r.structuredContent as any;
    return { text: (r.content as Array<{ text: string }>)[0]!.text, g: sc.grounded ?? sc };
  }
  const base = { postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", annualUsageKwh: 4000 };

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    mock = await startMockCdr({ retailers: { agl: [plan("single-rate", "RES1"), plan("business-single-rate", "BIZ1")] } });
    clearDataSets();
    clearReadinessChecks();
    rt = (await startEnergy({ DATABASE_URL: URL, DATABASE_SCHEMA: schema, ASKRIGHTO_SYNC_SCHEDULE: "off" } as NodeJS.ProcessEnv))!;
    await runSync({
      db,
      gstBasis: "EXCLUSIVE",
      client: new CdrClient({ baseUrl: mock.url, limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }) }),
      retailers: [{ slug: "agl", brandName: "AGL", active: true }],
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

  it("stores both customer types, and the store filters by type", async () => {
    const all = await plansByPostcode(db.pool, { postcode: "3000" });
    expect(all.map((p) => `${p.planId}:${p.customerType}`).sort()).toEqual(["BIZ1:BUSINESS", "RES1:RESIDENTIAL"]);
    expect((await plansByPostcode(db.pool, { postcode: "3000", customerType: "BUSINESS" })).map((p) => p.planId)).toEqual(["BIZ1"]);
    expect((await plansByPostcode(db.pool, { postcode: "3000", customerType: "RESIDENTIAL" })).map((p) => p.planId)).toEqual(["RES1"]);
  });

  it("search: residential by default, business only when asked, and the text says which", async () => {
    const home = await call("search_energy_plans", { postcode: "3000" });
    expect(home.g.data.plans.map((p: any) => p.planId)).toEqual(["RES1"]);
    expect(home.text).toMatch(/current residential plan/);
    const biz = await call("search_energy_plans", { postcode: "3000", customerType: "BUSINESS" });
    expect(biz.g.data.plans.map((p: any) => p.planId)).toEqual(["BIZ1"]);
    expect(biz.g.data.customerType).toBe("BUSINESS");
    expect(biz.text).toMatch(/current business plan/);
  });

  it("compare: a business is compared only with business plans and a household only with residential plans", async () => {
    const home = await call("compare_energy_plans", base);
    expect(home.g.data.estimates.map((e: any) => e.planId)).toEqual(["RES1"]);
    expect(home.g.data.customerType).toBe("RESIDENTIAL");
    expect(home.text).toMatch(/residential plans only/);
    const biz = await call("compare_energy_plans", { ...base, customerType: "BUSINESS" });
    expect(biz.g.data.estimates.map((e: any) => e.planId)).toEqual(["BIZ1"]);
    expect(biz.text).toMatch(/business plans only/);
    expect(biz.g.data.assumptions.join(" ")).toMatch(/business plans, compared only with business plans/);
    expect(biz.g.data.assumptions.join(" ")).toMatch(/GST/);
  });

  it("compare: there is no typical usage for a business", async () => {
    const r = await call("compare_energy_plans", { postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", customerType: "BUSINESS", useBenchmarkUsage: true, householdSize: 2 });
    expect(r.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(r.g.message).toMatch(/households only/);
    const none = await call("compare_energy_plans", { postcode: "3000", fuelType: "ELECTRICITY", distributor: "CitiPower", customerType: "BUSINESS" });
    expect(none.g.message).toMatch(/no typical usage for a business/);
    expect(none.g.message).not.toMatch(/how many people live/);
  });

  it("get_energy_plan: shows the plan's own customer type", async () => {
    expect((await call("get_energy_plan", { planId: "BIZ1" })).g.data.customerType).toBe("BUSINESS");
    expect((await call("get_energy_plan", { planId: "BIZ1" })).text).toMatch(/business electricity/);
    expect((await call("get_energy_plan", { planId: "RES1" })).g.data.customerType).toBe("RESIDENTIAL");
  });
});
