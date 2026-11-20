/**
 * the current plan pick list as a form, and plans whose bands are all labelled SHOULDER. Database parts need TEST_DATABASE_URL and run in a throwaway schema.
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

d("list_current_plan_options: a choice the user can make", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  // Four bands all labelled SHOULDER, told apart by their hours and rates (the AGL and Momentum style).
  const allShoulder = (planId: string) => {
    const f = structuredClone(fixture("time-of-use"));
    const d = f.data ?? f;
    d.planId = planId;
    d.brandName = "Momentum Energy";
    d.electricityContract.tariffPeriod[0].timeOfUseRates = [
      ["0000", "1100", "0.10"],
      ["1100", "1600", "0.20"],
      ["1600", "2100", "0.30"],
      ["2100", "2400", "0.15"],
    ].map(([a, b, p]) => ({ type: "SHOULDER", rates: [{ unitPrice: p, measureUnit: "KWH" }], timeOfUse: [{ days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], startTime: a, endTime: b }] }));
    return { detail: f };
  };
  const single = (planId: string) => {
    const f = structuredClone(fixture("single-rate"));
    const d = f.data ?? f;
    d.planId = planId;
    d.brandName = "Momentum Energy";
    d.geography = { distributors: ["Jemena"], includedPostcodes: ["3000"] };
    return { detail: f };
  };
  const args = { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", retailer: "Momentum", distributor: "Jemena" };

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    mock = await startMockCdr({ retailers: { momentum: [allShoulder("M1"), allShoulder("M2"), single("M3")] } });
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

  it("shows each band of a plan labelled SHOULDER with its own hours and rate, not one rate for all", async () => {
    const r = await client.callTool({ name: "list_current_plan_options", arguments: args });
    const g = ((r.structuredContent as any).grounded ?? r.structuredContent) as any;
    const tou = g.data.options.find((o: any) => o.tariff === "time of use");
    expect(tou.ratesIncGst).toHaveLength(4);
    expect(tou.ratesIncGst.map((x: any) => x.perUnit)).toEqual(["$0.1100", "$0.2200", "$0.3300", "$0.1650"]);
    expect(tou.ratesIncGst[1].hours).toMatch(/11am to 4pm/);
    expect(tou.ratesIncGst[1].hours).not.toMatch(/^Shoulder/);
    const text = (r.content as Array<{ text: string }>)[0]!.text;
    expect(text).toMatch(/shoulder 11am to 4pm on every day \$0\.2200/);
  });

  it("matches an invoice's shoulder rate against any of a plan's shoulder rates", async () => {
    const r = await client.callTool({ name: "list_current_plan_options", arguments: { ...args, shoulderRatePerUnit: 0.33 } });
    const g = ((r.structuredContent as any).grounded ?? r.structuredContent) as any;
    const tou = g.data.options.find((o: any) => o.tariff === "time of use");
    expect(tou.matchedOn).toContain("shoulder rate");
  });

  it("is drawn as a form with a choice of options and a none-of-these answer, not one long text", async () => {
    const r = await client.callTool({ name: "list_current_plan_options", arguments: args });
    const sc = r.structuredContent as any;
    expect(JSON.stringify(sc)).toMatch(/currentPlan/);
    const pick = JSON.stringify(sc);
    expect(pick).toMatch(/None of these is my plan/);
    expect(pick).toMatch(/Option 1/);
    expect(pick).toMatch(/Use this plan/);
    // The full text is still there for hosts that draw no component, with the ids the next call needs.
    expect((r.content as Array<{ text: string }>)[0]!.text).toMatch(/Plan ids: .*M[12]/);
  });
});
