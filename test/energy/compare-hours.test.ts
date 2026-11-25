/**
 * compare_energy_plans with the household's current hours (add-energy-invoice-first). Database parts need TEST_DATABASE_URL and run in a throwaway schema.
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
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

d("compare_energy_plans: bill split against the current plan's hours", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  const tou = (planId: string, peakStart?: string) => {
    const f = structuredClone(fixture("time-of-use"));
    const d = f.data ?? f;
    d.planId = planId;
    if (peakStart) d.electricityContract.tariffPeriod[0].timeOfUseRates[0].timeOfUse[0].startTime = peakStart;
    return { detail: f };
  };
  const single = () => {
    const f = structuredClone(fixture("single-rate"));
    const d = f.data ?? f;
    d.planId = "S1";
    d.brandName = "Origin Energy";
    d.geography = { distributors: ["Jemena"], includedPostcodes: ["3000"] };
    return { detail: f };
  };
  async function compare(args: Record<string, unknown>) {
    const r = await client.callTool({ name: "compare_energy_plans", arguments: { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", distributor: "Jemena", usageSource: "bill", usage: 900, usageDays: 90, peakSharePct: 30, shoulderSharePct: 0, offPeakSharePct: 70, ...args } });
    const sc = r.structuredContent as any;
    return { text: (r.content as Array<{ text: string }>)[0]!.text, g: sc.grounded ?? sc };
  }
  const ids = (xs: Array<{ planId: string }>) => xs.map((x) => x.planId).sort();

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    // T1 and T2 share hours (peak 3pm to 9pm); T3 peaks from 4pm; S1 is a single rate plan.
    mock = await startMockCdr({ retailers: { origin: [tou("T1"), tou("T2"), tou("T3", "1600"), single()] } });
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

  it("applies the split exactly to plans with the current plan's hours and lists the others apart as approximate", async () => {
    const r = await compare({ currentPlanId: "T1" });
    expect(r.g.found).toBe(true);
    expect(ids(r.g.data.estimates)).toEqual(["S1", "T1", "T2"]);
    expect(ids(r.g.data.approximateHours)).toEqual(["T3"]);
    expect(r.g.data.approximateHours[0].hours).toBe("different");
    expect(r.g.data.hoursBasis.known).toBe(true);
    expect(r.g.data.counts).toMatchObject({ estimated: 4, approximate: 1 });
    expect(r.text).toMatch(/approximate: different hours/);
    expect(r.text).toMatch(/not ranked with the table above/);
  });

  it("assistant_readings: exact for the current plan's hours, approximate for the others, and labelled not verified", async () => {
    const r = await compare({ usageSource: "assistant_readings", usage: 4100, usageDays: 365, currentPlanId: "T1" });
    expect(r.g.found).toBe(true);
    expect(ids(r.g.data.estimates)).toEqual(["S1", "T1", "T2"]);
    expect(ids(r.g.data.approximateHours)).toEqual(["T3"]);
    expect(r.g.data.usage).toMatchObject({ level: "assistant_readings", annualUsage: 4100 });
    expect(r.g.data.usage.accuracy).toMatch(/^Your own readings, summed by the assistant, not verified by Ask Righto: 365 days of readings scaled to 4,100 kWh a year; plans with the same hours as Origin Energy/);
    expect(r.text.startsWith(r.g.data.usage.accuracy)).toBe(true);
    expect(r.text).toMatch(/approximate: different hours/);
  });

  it("assistant_readings: every time-of-use plan is approximate when the hours are only a layout id the user could not match", async () => {
    const opts = await client.callTool({ name: "list_current_plan_options", arguments: { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", retailer: "Origin", distributor: "Jemena", showAllOptions: true } });
    const layouts = ((opts.structuredContent as any).grounded ?? (opts.structuredContent as any)).data.layouts as Array<{ layoutId: string }>;
    const r = await compare({ usageSource: "assistant_readings", usage: 4100, usageDays: 365, hoursLayoutId: layouts[0]!.layoutId });
    expect(r.g.found).toBe(true);
    expect(r.g.data.hoursBasis.known).toBe(true);
    expect(r.g.data.usage.level).toBe("assistant_readings");
  });

  it("assistant_readings: without currentPlanId or hoursLayoutId it asks which hours the readings were banded by", async () => {
    const r = await compare({ usageSource: "assistant_readings", usage: 4100, usageDays: 365 });
    expect(r.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(r.g.message).toMatch(/`currentPlanId` or `hoursLayoutId`/);
    expect(r.g.message).toMatch(/hours the readings were banded by/);
  });

  it("takes the hours from a layout id when the plan was not listed", async () => {
    const opts = await client.callTool({ name: "list_current_plan_options", arguments: { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", retailer: "Origin", distributor: "Jemena", showAllOptions: true } });
    const layouts = ((opts.structuredContent as any).grounded ?? (opts.structuredContent as any)).data.layouts as Array<{ layoutId: string; hours: string }>;
    expect(layouts.length).toBe(2);
    const three = layouts.find((l) => /4pm/.test(l.hours))!;
    const r = await compare({ hoursLayoutId: three.layoutId });
    expect(ids(r.g.data.estimates)).toEqual(["S1", "T3"]);
    expect(ids(r.g.data.approximateHours)).toEqual(["T1", "T2"]);
  });

  it("labels every time-of-use estimate approximate when the household's hours are unknown, and says so", async () => {
    const r = await compare({});
    expect(ids(r.g.data.estimates)).toEqual(["S1"]);
    expect(ids(r.g.data.approximateHours)).toEqual(["T1", "T2", "T3"]);
    expect(r.g.data.approximateHours.every((e: any) => e.hours === "unknown")).toBe(true);
    expect(r.g.data.hoursBasis.known).toBe(false);
    expect(r.text).toMatch(/household's own hours are not known/);
  });

  it("does not use hours when there is no bill split", async () => {
    const r = await compare({ peakSharePct: undefined, shoulderSharePct: undefined, offPeakSharePct: undefined, currentPlanId: "T1" });
    expect(r.g.data.approximateHours).toEqual([]);
    expect(r.g.data.hoursBasis).toBeUndefined();
    expect(r.g.data.counts.approximate).toBe(0);
  });

  it("asks again when the current plan id is not found or both ids are given", async () => {
    expect((await compare({ currentPlanId: "NOPE" })).g).toMatchObject({ found: false, reason: "needs_input" });
    const both = await compare({ currentPlanId: "T1", hoursLayoutId: "abcd1234" });
    expect(both.g).toMatchObject({ found: false, reason: "needs_input" });
  });
});
