/**
 * summarise_interval_readings and compare_energy_plans with readingsProfile, over MCP against a PostgreSQL loaded from
 * synthetic fixtures. Needs TEST_DATABASE_URL like tools.test.ts. The readings are synthetic (made-up NMI).
 */
import { randomBytes } from "node:crypto";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { clearDataSets } from "../../src/core/registry.js";
import { clearReadinessChecks } from "../../src/core/readiness.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { startEnergy, type EnergyRuntime } from "../../src/energy/index.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { runSync } from "../../src/energy/sync.js";
import { createServer } from "../../src/server/create-server.js";
import { serverInstructions } from "../../src/server/instructions.js";
import { datesFrom, FAKE_NMI, FAKE_SERIAL, makeNem12 } from "./nem12-fixture.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;

let db: Db;
let mock: MockCdr;
let rt: EnergyRuntime;
let client: Client;

const ALL = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const tou = (planId: string, windows: { peak: unknown[]; off: unknown[] }) => {
  const base = fixture("time-of-use") as any;
  base.planId = planId;
  base.displayName = `Windows ${planId}`;
  base.geography = { distributors: ["Jemena"], includedPostcodes: ["3000"] };
  const [peak, off] = base.electricityContract.tariffPeriod[0].timeOfUseRates;
  peak.timeOfUse = windows.peak;
  off.timeOfUse = windows.off;
  return { detail: base };
};

async function call(name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as Array<{ text: string }>)[0]!.text;
  const sc = r.structuredContent as any;
  return { text, g: sc.grounded ?? sc, raw: r };
}

beforeAll(async () => {
  if (!URL) return;
  db = createDb({ url: URL, schema, poolMax: 5 });
  await migrate(db);
  mock = await startMockCdr({
    retailers: {
      origin: [
        // Complete windows: peak 3pm to 9pm every day, off-peak the rest.
        tou("FULL", { peak: [{ days: ALL, startTime: "1500", endTime: "2100" }], off: [{ days: ALL, startTime: "2100", endTime: "1500" }] }),
        // Windows leave 7am to 3pm uncovered (the shape of the plain time-of-use fixture).
        tou("GAPPY", { peak: [{ days: ["MON", "TUE", "WED", "THU", "FRI"], startTime: "1500", endTime: "2100" }], off: [{ days: ALL, startTime: "2100", endTime: "0700" }] }),
      ],
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
  if (!URL) return;
  await client.close();
  await mock.close();
  clearDataSets();
  clearReadinessChecks();
  await rt.stop().catch(() => undefined);
  const admin = new pg.Pool({ connectionString: URL });
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

// A year of use that is 1 kWh in each half hour from 16:00 to 18:00 AEST (peak) and 0.1 otherwise; with solar export.
const year = datesFrom("2026-01-01", 365);
const yearFile = makeNem12({
  dates: year,
  streams: [{ suffix: "E1", value: (_d, k) => (k >= 32 && k < 36 ? 1 : 0.1) }, { suffix: "B1", value: () => 0.05 }],
});
const base = { postcode: "3000", fuelType: "ELECTRICITY", distributor: "Jemena" };

d("summarise_interval_readings", () => {
  it("is listed and returns an identifier-free profile with the period and totals", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("summarise_interval_readings");
    const { g, text } = await call("summarise_interval_readings", { readingsText: yearFile });
    expect(g.found).toBe(true);
    expect(g.data.period).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(g.data.daysPresent).toBe(365);
    expect(g.data.annualKwh).toBe(Math.round(365 * (4 * 1 + 44 * 0.1)));
    expect(g.data.annualExportKwh).toBe(Math.round(365 * 48 * 0.05));
    expect(g.source.name).toMatch(/own interval readings/);
    expect(g.source.licence).toMatch(/not stored/);
    for (const out of [JSON.stringify(g), text]) {
      expect(out).not.toContain(FAKE_NMI);
      expect(out).not.toContain(FAKE_SERIAL);
    }
    expect(text).toMatch(/Controlled load is not costed separately/);
  });

  it("logs nothing from the input, even when it fails", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const bad = yearFile.replace("0.100", "NOTANUMBER");
    const { g } = await call("summarise_interval_readings", { readingsText: bad });
    expect(g.found).toBe(false);
    expect(g.message).not.toContain("NOTANUMBER");
    const logged = [...spies.flatMap((s) => s.mock.calls), ...stderr.mock.calls].flat().join(" ");
    expect(logged).not.toContain(FAKE_NMI);
    expect(logged).not.toContain("NOTANUMBER");
    spies.forEach((s) => s.mockRestore());
    stderr.mockRestore();
  });

  it("refuses NEM13 with a plain reason and no figures", async () => {
    const { g } = await call("summarise_interval_readings", { readingsText: "100,NEM13,200301011534,MDP1,Retailer1\n250,1234567890,1141,01,11,11,M,E,0,2003,A,,,0,2004\n900" });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/accumulation/);
  });
});

d("compare_energy_plans with readingsProfile", () => {
  async function profileFor(text: string): Promise<string> {
    const { g } = await call("summarise_interval_readings", { readingsText: text });
    return g.data.profile as string;
  }

  it("estimates a time-of-use plan from the readings and labels the basis, period and omissions", async () => {
    const readingsProfile = await profileFor(yearFile);
    const { g, text } = await call("compare_energy_plans", { ...base, readingsProfile });
    expect(g.found).toBe(true);
    expect(g.data.usage.basis).toBe("readings");
    expect(g.data.usage.readings).toMatchObject({ start: "2026-01-01", end: "2026-12-31", daysPresent: 365, scaled: false, partial: false });
    const full = g.data.estimates.find((e: any) => e.planId === "FULL");
    expect(full).toBeTruthy();
    // 1 kWh peak 16:00 to 18:00 AEST is 17:00 to 19:00 local in summer, 16:00 to 18:00 in winter: always peak (3pm to 9pm).
    // Peak share = 4 x 1 / (4 + 4.4) = 47.6%; solar credit 0.05 x 876 kWh.
    expect(full.breakdown.feedInCreditCents).toBe(-Math.round(876 * 5));
    expect(text).toMatch(/own interval readings, 2026-01-01 to 2026-12-31/);
    expect(text).toMatch(/Controlled load is not costed separately/);
    expect(text).not.toMatch(/More accurate comparison/); // the readings prompt is not shown when readings were used
    expect(g.data.readingsNote).toBeUndefined();
  });

  it("lists a plan whose windows leave part of the day uncovered as not estimated, with the reason", async () => {
    const readingsProfile = await profileFor(yearFile);
    const { g } = await call("compare_energy_plans", { ...base, readingsProfile });
    const gappy = g.data.notEstimated.find((e: any) => e.planId === "GAPPY");
    expect(gappy).toMatchObject({ reason: "not_fully_understood" });
    expect(gappy.detail).toMatch(/uncovered/);
  });

  it("moves use across the window edge with daylight saving", async () => {
    // Use only in the AEST half hour 14:00 to 14:30: 14:00 local in Queensland-like winter (outside the 15:00 peak),
    // 15:00 local in summer (inside the peak).
    const edge = makeNem12({ dates: datesFrom("2026-01-01", 365), streams: [{ suffix: "E1", value: (_d, k) => (k === 28 ? 2 : 0) }] });
    const readingsProfile = await profileFor(edge);
    const { g } = await call("compare_energy_plans", { ...base, readingsProfile });
    const full = g.data.estimates.find((e: any) => e.planId === "FULL");
    const usageDollars = full.breakdown.usageCents;
    // Summer (Jan to Mar, Oct 6 to Dec, about 6 months) is peak at 0.45 (+GST), winter off-peak at 0.18: between the two extremes.
    const kwh = 2 * 365;
    expect(usageDollars).toBeGreaterThan(Math.round(kwh * 18 * 1.1) + 100);
    expect(usageDollars).toBeLessThan(Math.round(kwh * 45 * 1.1) - 100);
  });

  it("prefers the readings over other usage figures and says what was not used", async () => {
    const readingsProfile = await profileFor(yearFile);
    const { g, text } = await call("compare_energy_plans", { ...base, readingsProfile, annualUsageKwh: 9999, solarExportAnnualKwh: 1 });
    expect(g.data.usage.annualUsage).toBe(Math.round(365 * 8.4));
    expect(g.data.usage.readings.notUsed.join(" ")).toMatch(/usage figure given/);
    expect(text).toMatch(/Not used:/);
  });

  it("labels a short period as partial, and refuses under 90 days", async () => {
    const part = await profileFor(makeNem12({ dates: datesFrom("2026-01-01", 120), streams: [{ suffix: "E1" }] }));
    const p = (await call("compare_energy_plans", { ...base, readingsProfile: part })).g;
    expect(p.data.usage.readings).toMatchObject({ daysPresent: 120, partial: true, scaled: true });
    const short = await profileFor(makeNem12({ dates: datesFrom("2026-01-01", 30), streams: [{ suffix: "E1" }] }));
    const s = (await call("compare_energy_plans", { ...base, readingsProfile: short })).g;
    expect(s).toMatchObject({ found: false, reason: "needs_input" });
    expect(s.message).toMatch(/too short/);
  });

  it("rejects a malformed profile and gas", async () => {
    expect((await call("compare_energy_plans", { ...base, readingsProfile: "{}" })).g).toMatchObject({ found: false, reason: "needs_input" });
    const readingsProfile = await profileFor(yearFile);
    const gas = (await call("compare_energy_plans", { postcode: "3000", fuelType: "GAS", readingsProfile })).g;
    expect(gas).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("server instructions say when to offer the readings and never to send the file elsewhere", () => {
    const ins = serverInstructions();
    expect(ins).toMatch(/summarise_interval_readings/);
    expect(ins).toMatch(/readingsProfile/);
  });
});
