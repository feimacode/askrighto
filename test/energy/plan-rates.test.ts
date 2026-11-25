/**
 * compare_energy_plan_rates (add-energy-plan-rates-tool): published rates of 2 to 5 named plans side by side, with no
 * usage, total or ranking. Database parts need TEST_DATABASE_URL and run in a throwaway schema.
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
import { createServer } from "../../src/server/create-server.js";
import { RATES_CLOSING } from "../../src/tools/compare-energy-plan-rates.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

d("compare_energy_plan_rates (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  const plan = (name: string, planId: string, displayName?: string) => {
    const f = structuredClone(fixture(name));
    const x = f.data ?? f;
    x.planId = planId;
    if (displayName) x.displayName = displayName;
    return { detail: f };
  };
  async function call(args: Record<string, unknown>) {
    const r = await client.callTool({ name: "compare_energy_plan_rates", arguments: args });
    const sc = r.structuredContent as any;
    return { r, text: (r.content as Array<{ text: string }>)?.[0]?.text ?? "", g: sc?.grounded ?? sc };
  }
  const base = { postcode: "3000" };

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    // R1, R2: single rate on CitiPower. J1: time of use on Jemena. G1, G2: block-rate gas on CitiPower. B1: business, AusNet.
    mock = await startMockCdr({
      retailers: {
        origin: [plan("single-rate", "R1", "First Plan"), plan("single-rate", "R2", "Second Plan"), plan("time-of-use", "J1"), plan("block-rates-gas", "G1", "Gas One"), plan("block-rates-gas", "G2", "Gas Two"), plan("business-single-rate", "B1")],
      },
    });
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

  it("is listed as a read-only tool that draws a comparison", async () => {
    const t = (await client.listTools()).tools.find((x) => x.name === "compare_energy_plan_rates")!;
    expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(t.title).toBeTruthy();
    expect(t.description).toMatch(/no usage/);
    expect((t._meta as any)?.ui?.resourceUri).toBe("ui://inkview/v1/app.html");
  });

  it("lines up two plans in the order given, with a row for every item and 'not offered' where a plan has none", async () => {
    const { g, text } = await call({ ...base, planIds: ["R2", "R1"] });
    expect(g.found).toBe(true);
    expect(g.data.plans.map((p: any) => p.planId)).toEqual(["R2", "R1"]);
    expect(g.data.fuels).toEqual(["ELECTRICITY"]);
    expect(g.data.distributors).toEqual(["CitiPower"]);
    expect(g.data.rows.map((r: any) => r.label)).toEqual(["Daily supply charge", "Usage rates and hours", "Controlled load", "Solar feed-in", "Discounts", "Fees", "Contract length", "Eligibility"]);
    for (const r of g.data.rows) expect(r.cells).toHaveLength(2);
    expect(g.data.rows.find((r: any) => r.label === "Daily supply charge").cells[0]).toMatch(/\$[\d.]+\/day/);
    expect(g.data.rows.find((r: any) => r.label === "Usage rates and hours").cells[0]).toMatch(/\d\.\d+\/kWh/);
    expect(g.data.rows.some((r: any) => r.cells.includes("not offered"))).toBe(true);
    expect(text.indexOf("Second Plan")).toBeLessThan(text.indexOf("First Plan"));
    for (const p of g.data.plans) {
      expect(p.link).toBeDefined();
      expect(p.sourceLastUpdated).toBeTruthy();
    }
    expect(g.source.url).toMatch(/aer\.gov\.au/);
    expect(g.asOf).toBeTruthy();
    expect(text).toMatch(/Plan links:/);
  });

  it("keeps a conditional discount with its condition", async () => {
    const { g } = await call({ ...base, planIds: ["R1", "R2"] });
    const disc = g.data.rows.find((r: any) => r.label === "Discounts").cells[0];
    expect(disc).toMatch(/Pay on time/);
    expect(disc).toMatch(/conditions apply/);
  });

  it("gives no yearly cost, total or ranking, and ends with the line that says a cost needs usage", async () => {
    const { g, text, r } = await call({ ...base, planIds: ["R1", "R2"] });
    const all = `${text}\n${JSON.stringify(g)}`;
    expect(all).not.toMatch(/totalCents|annualUsage|estimated yearly|an estimate/i);
    expect(text).not.toMatch(/\bcheapest\b|\bbest\b|\brecommended\b|\bbetter\b|\bsave\b|\brank/i);
    expect(text).not.toMatch(/\$[\d,.]+ a year|\$[\d,.]+ per year/);
    expect(g.data.plans[0].estimate).toBeUndefined();
    expect(g.data.closing).toBe(RATES_CLOSING);
    expect(text).toContain(RATES_CLOSING);
    expect(text.indexOf(RATES_CLOSING)).toBeLessThan(text.indexOf(g.data.notice));
    // The drawn component never carries a recommendation.
    expect(JSON.stringify(r)).not.toMatch(/"recommended"/);
  });

  it("labels the current plan as theirs and judges nothing", async () => {
    const { g, text } = await call({ ...base, planIds: ["R1", "R2"], currentPlanId: "R2" });
    expect(g.data.currentPlanId).toBe("R2");
    expect(g.data.plans.map((p: any) => p.isCurrent)).toEqual([false, true]);
    expect(text).toMatch(/Second Plan \(your current plan\)/);
    expect(text).not.toMatch(/First Plan \(your current plan\)/);
  });

  it("shows block rates with their thresholds, for two gas plans", async () => {
    const { g, text } = await call({ ...base, planIds: ["G1", "G2"] });
    expect(g.found).toBe(true);
    expect(g.data.fuels).toEqual(["GAS"]);
    expect(text).toMatch(/for the first/);
  });

  it("refuses unknown ids by name, and makes no estimate", async () => {
    const { g } = await call({ ...base, planIds: ["R1", "NOPE1", "NOPE2"] });
    expect(g).toMatchObject({ found: false, reason: "not_in_dataset" });
    expect(g.message).toMatch(/"NOPE1", "NOPE2"/);
    expect(g.data).toBeUndefined();
  });

  it("refuses fewer than two or more than five ids at the schema, and repeated ids", async () => {
    expect((await client.callTool({ name: "compare_energy_plan_rates", arguments: { ...base, planIds: ["R1"] } })).isError).toBe(true);
    expect((await client.callTool({ name: "compare_energy_plan_rates", arguments: { ...base, planIds: ["R1", "R2", "G1", "G2", "J1", "B1"] } })).isError).toBe(true);
    expect((await call({ ...base, planIds: ["R1", "R1"] })).g).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("refuses a current plan that is not one of the ids", async () => {
    const { g } = await call({ ...base, planIds: ["R1", "R2"], currentPlanId: "G1" });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/currentPlanId G1 is not one of planIds/);
  });

  it("refuses plans on different distributors, naming them", async () => {
    const { g } = await call({ ...base, planIds: ["R1", "J1"] });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/different distributors/);
    expect(g.message).toMatch(/CitiPower/);
    expect(g.message).toMatch(/Jemena/);
    expect(g.message).toMatch(/which distributor is on their bill/);
  });

  it("refuses plans that share no fuel, and a mix of home and business plans", async () => {
    const fuel = await call({ ...base, planIds: ["R1", "G1"] });
    expect(fuel.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(fuel.g.message).toMatch(/do not share a fuel/);
    const kinds = await call({ ...base, planIds: ["R1", "B1"] });
    expect(kinds.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(kinds.g.message).toMatch(/homes and businesses/);
  });

  it("refuses plans not offered at the postcode", async () => {
    const { g } = await call({ postcode: "2000", planIds: ["R1", "R2"] });
    expect(g).toMatchObject({ found: false, reason: "not_in_dataset" });
    expect(g.message).toMatch(/not offered at postcode 2000/);
  });

  it("asks for a postcode of four digits", async () => {
    expect((await call({ postcode: "30", planIds: ["R1", "R2"] })).g).toMatchObject({ found: false, reason: "needs_input" });
  });
});
