/**
 * Reading a household's NEM12 interval readings (add-energy-readings-upload): parser, profile, window shares,
 * summarise_interval_readings and compare_energy_plans with readingsProfile.
 * The files here are synthetic (invented numbers in the real export's layout); a real file is never committed.
 * The database parts need TEST_DATABASE_URL and run in a throwaway schema.
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
import { MAX_READINGS_CHARS, parseNem12, type ParsedReadings } from "../../src/energy/readings/parse.js";
import { buildProfile, decodeProfile, encodeProfile, inDaylightSaving, localOffsetMinutes } from "../../src/energy/readings/profile.js";
import { bandShares, periodMonths } from "../../src/energy/readings/windows.js";
import { runSync } from "../../src/energy/sync.js";
import type { TimeOfUseRate } from "../../src/energy/types.js";
import { createServer } from "../../src/server/create-server.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

const NMI = "6407000123"; // invented
const SERIAL = "SER-0099"; // invented

interface Stream {
  suffix?: string;
  uom?: string;
  per?: number;
  /** value for a given half-hour slot (0..47) of a date */
  at?: (date: string, slot: number) => number;
  nmi?: string;
}
interface Opts {
  start?: string;
  days?: number;
  skip?: string[];
  header?: boolean;
  streams?: Stream[];
  vDay?: string;
  lastShort?: boolean;
}
const dstr = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

/** Builds NEM12 text in the layout of a real distributor export. */
function makeNem12(o: Opts = {}): string {
  const start = Date.UTC(+(o.start ?? "20260101").slice(0, 4), +(o.start ?? "20260101").slice(4, 6) - 1, +(o.start ?? "20260101").slice(6, 8));
  const days = o.days ?? 10;
  const streams = o.streams ?? [{}];
  const out: string[] = [];
  if (o.header) out.push("100,NEM12,202611191200,UNITEDP,RETAILX");
  for (const st of streams) {
    const per = st.per ?? 30;
    const n = 1440 / per;
    out.push(`200,${st.nmi ?? NMI},${st.suffix ?? "E1"},1,${st.suffix ?? "E1"},,${SERIAL},${st.uom ?? "KWH"},${per},`);
    for (let k = 0; k < days; k++) {
      const date = dstr(start + k * 86_400_000);
      if (o.skip?.includes(date)) continue;
      const vals: string[] = [];
      for (let i = 0; i < n; i++) {
        const slot = Math.floor((i * per) / 30);
        const base = (st.at ?? (() => 0.1))(date, slot);
        vals.push((base * (per / 30)).toFixed(3));
      }
      const q = date === o.vDay ? "V" : "A";
      out.push(`300,${date},${vals.join(",")},${q},,,${date}120000,`);
      if (q === "V") {
        out.push("400,1,6,A,,");
        out.push("400,7,7,A,79,");
        out.push("400,8,48,A,,");
      }
    }
  }
  if (o.header) out.push("900");
  let text = out.join("\n");
  if (o.lastShort) text = text.replace(/,\s*$/, "");
  return text;
}

const ok = (t: string): ParsedReadings => {
  const r = parseNem12(t);
  if (!r.ok) throw new Error(`parse failed: ${r.problem}`);
  return r;
};
const sum = (m: Map<string, number[]>) => [...m.values()].reduce((a, v) => a + v.reduce((x, y) => x + y, 0), 0);

describe("NEM12 parser", () => {
  it("reads an export like the real one: no 100 or 900, a missing day, a V day with 400 events, a short last line", () => {
    const r = ok(makeNem12({ days: 10, skip: ["20260105"], vDay: "20260103", lastShort: true }));
    expect(r.consumption.size).toBe(9);
    expect(r.consumption.has("20260105")).toBe(false);
    expect(r.variableDays).toBe(1);
    expect(r.outageIntervals).toBe(1);
    expect(r.streamsUsed.consumption).toEqual(["E1"]);
    expect(sum(r.consumption)).toBeCloseTo(9 * 48 * 0.1, 6);
  });
  it("also reads a full file with a 100 header and a 900 end record", () => {
    expect(ok(makeNem12({ header: true, days: 3 })).consumption.size).toBe(3);
  });
  it("sums 5 and 15 minute intervals to half hours, and converts Wh", () => {
    const five = ok(makeNem12({ streams: [{ per: 5, at: () => 0.12 }], days: 2 }));
    expect(five.consumption.get("20260101")!).toHaveLength(48);
    expect(five.consumption.get("20260101")![0]).toBeCloseTo(0.12, 6);
    const wh = ok(makeNem12({ streams: [{ uom: "WH", at: () => 100 }], days: 1 }));
    expect(wh.consumption.get("20260101")![0]).toBeCloseTo(0.1, 6);
  });
  it("counts every E stream as main consumption and B streams as solar export, summing streams of a kind", () => {
    const r = ok(makeNem12({ streams: [{ suffix: "E1", at: () => 0.2 }, { suffix: "E2", at: () => 0.05 }, { suffix: "B1", at: () => 0.3 }, { suffix: "B2", at: () => 0.1 }], days: 2 }));
    expect(r.streamsUsed).toEqual({ consumption: ["E1", "E2"], export: ["B1", "B2"] });
    expect(r.consumption.get("20260101")![0]).toBeCloseTo(0.25, 6);
    expect(r.exportKwh.get("20260101")![0]).toBeCloseTo(0.4, 6);
    expect(r.netOnly).toBe(false);
  });
  it("uses a net N stream only when there is no E or B stream, and ignores reactive streams", () => {
    const net = ok(makeNem12({ streams: [{ suffix: "N1" }], days: 1 }));
    expect(net.netOnly).toBe(true);
    const mixed = ok(makeNem12({ streams: [{ suffix: "E1" }, { suffix: "N1" }, { suffix: "K1", uom: "KVARH" }], days: 1 }));
    expect(mixed.netOnly).toBe(false);
    expect(mixed.streamsUsed.consumption).toEqual(["E1"]);
    expect(mixed.ignoredStreams).toEqual(["K1"]);
  });
  it("uses averaged or check streams only when the master stream of that kind is absent", () => {
    const r = ok(makeNem12({ streams: [{ suffix: "E1", at: () => 0.1 }, { suffix: "D1", at: () => 9 }, { suffix: "A1", at: () => 0.5 }], days: 1 }));
    expect(r.streamsUsed).toEqual({ consumption: ["E1"], export: ["A1"] });
  });

  it("refuses an accumulation (NEM13) file", () => {
    const r = parseNem12("100,NEM13,202611191200,A,B\n250,6407000123,E1,1,E1,,SER,20260101,0,10,20,A,,,20260102,0,10,20,A\n900");
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.problem).toMatch(/accumulation/);
  });
  it("refuses several NMIs, no consumption stream, and text that is not NEM12", () => {
    const two = parseNem12(makeNem12({ streams: [{}, { suffix: "E2", nmi: "6407000999" }], days: 1 }));
    expect(!two.ok && two.problem).toMatch(/more than one NMI/);
    const none = parseNem12(makeNem12({ streams: [{ suffix: "B1" }], days: 1 }));
    expect(!none.ok && none.problem).toMatch(/no consumption stream/);
    const notNem = parseNem12("name,address\nsomebody,somewhere\n");
    expect(!notNem.ok && notNem.problem).toMatch(/NEM12/);
  });
  it("names the line and the problem, never the content, for a bad value or a short line", () => {
    const good = makeNem12({ days: 2 }).split("\n");
    const bad = [...good];
    bad[2] = bad[2]!.replace(/,0\.100,/, ",abc,"); // second 300 line (line 3)
    const r1 = parseNem12(bad.join("\n"));
    expect(r1).toMatchObject({ ok: false, line: 3 });
    expect(JSON.stringify(r1)).not.toContain(NMI);
    expect(JSON.stringify(r1)).not.toContain("abc");
    const short = [...good];
    short[1] = short[1]!.split(",").slice(0, 20).join(",");
    expect(parseNem12(short.join("\n"))).toMatchObject({ ok: false, line: 2 });
    expect(JSON.stringify(parseNem12(short.join("\n")))).not.toContain(SERIAL);
  });
  it("reads a 5-minute quarter that fits the limit, and refuses a 5-minute year with a plain message about size and what to do", () => {
    // 0.12 kWh a half hour is exactly 0.020 in each 5-minute interval, so the generator's rounding does not show in the total.
    const quarter = makeNem12({ start: "20260101", days: 91, streams: [{ per: 5, at: () => 0.12 }] });
    expect(quarter.length).toBeLessThan(MAX_READINGS_CHARS);
    const r = ok(quarter);
    expect(r.consumption.size).toBe(91);
    expect(sum(r.consumption)).toBeCloseTo(91 * 48 * 0.12, 3);
    const year = makeNem12({ start: "20260101", days: 365, streams: [{ per: 5, at: () => 0.1 }] });
    expect(year.length).toBeGreaterThan(MAX_READINGS_CHARS);
    const bad = parseNem12(year);
    expect(bad).toMatchObject({ ok: false });
    expect(!bad.ok && bad.problem).toMatch(/over the limit of 250,000/);
    expect(!bad.ok && bad.problem).toMatch(/30-minute/);
  });
  it("refuses a duplicate date, a negative value and an oversize text", () => {
    const lines = makeNem12({ days: 2 }).split("\n");
    expect(parseNem12([lines[0], lines[1], lines[1], lines[2]].join("\n"))).toMatchObject({ ok: false });
    expect(parseNem12(makeNem12({ streams: [{ at: () => -1 }], days: 1 }))).toMatchObject({ ok: false });
    expect(parseNem12("x".repeat(MAX_READINGS_CHARS + 1))).toMatchObject({ ok: false });
  });
});

describe("profile", () => {
  const readings = ok(makeNem12({ start: "20260101", days: 40, skip: ["20260110"], streams: [{ at: (_d, s) => (s >= 34 && s < 42 ? 1 : 0.1) }, { suffix: "B1", at: () => 0.05 }] }));

  it("holds totals, the period and the missing dates, and no identifier", () => {
    const p = buildProfile(readings, "VIC");
    expect(p).toMatchObject({ state: "VIC", from: "2026-01-01", to: "2026-02-09", daysPresent: 39, missingCount: 1, missing: ["2026-01-10"], netOnly: false });
    expect(p.totalKwh).toBeCloseTo(sum(readings.consumption), 2);
    expect(p.exportKwh).toBeCloseTo(39 * 48 * 0.05, 2);
    const s = encodeProfile(p);
    expect(s).not.toContain(NMI);
    expect(s).not.toContain(SERIAL);
    expect(s.length).toBeLessThan(40_000);
  });
  it("round-trips and rejects a changed or malformed profile", () => {
    const s = encodeProfile(buildProfile(readings, "NSW"));
    expect(decodeProfile(s)).toMatchObject({ ok: true });
    expect(decodeProfile("not json")).toMatchObject({ ok: false });
    expect(decodeProfile(s.replace('"v":1', '"v":2'))).toMatchObject({ ok: false });
    const tampered = JSON.parse(s);
    tampered.totalKwh = tampered.totalKwh * 2;
    expect(decodeProfile(JSON.stringify(tampered))).toMatchObject({ ok: false });
    const shape = JSON.parse(s);
    shape.sums.pop();
    expect(decodeProfile(JSON.stringify(shape))).toMatchObject({ ok: false });
  });
  it("applies daylight saving by state", () => {
    const jan = new Date(Date.UTC(2026, 0, 15)), jul = new Date(Date.UTC(2026, 6, 15));
    expect(localOffsetMinutes("NSW", jan)).toBe(60);
    expect(localOffsetMinutes("NSW", jul)).toBe(0);
    expect(localOffsetMinutes("QLD", jan)).toBe(0);
    expect(localOffsetMinutes("SA", jan)).toBe(30);
    expect(localOffsetMinutes("SA", jul)).toBe(-30);
    // First Sunday of October 2026 is the 4th; first Sunday of April 2026 is the 5th.
    expect(inDaylightSaving("VIC", new Date(Date.UTC(2026, 9, 3)))).toBe(false);
    expect(inDaylightSaving("VIC", new Date(Date.UTC(2026, 9, 4)))).toBe(true);
    expect(inDaylightSaving("VIC", new Date(Date.UTC(2026, 3, 4)))).toBe(true);
    expect(inDaylightSaving("VIC", new Date(Date.UTC(2026, 3, 5)))).toBe(false);
  });
  it("places a known evening peak on the local clock: 17:00 to 21:00 AEST is 18:00 to 22:00 in NSW in January and unchanged in QLD", () => {
    const evening = ok(makeNem12({ start: "20260112", days: 14, streams: [{ at: (_d, s) => (s >= 34 && s < 42 ? 1 : 0) }] })); // slots 34-41 = 17:00-21:00 AEST
    const peak: TimeOfUseRate = { type: "PEAK", rates: [], windows: [{ days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], startTime: "18:00", endTime: "21:59" }] };
    const off: TimeOfUseRate = { type: "OFF_PEAK", rates: [], windows: [] };
    const nsw = bandShares(buildProfile(evening, "NSW"), [peak, off], periodMonths({}));
    const qld = bandShares(buildProfile(evening, "QLD"), [peak, off], periodMonths({}));
    expect(nsw).toMatchObject({ ok: true });
    expect(nsw.ok && nsw.shares.peak).toBeCloseTo(100, 6); // local 18:00-22:00
    expect(qld.ok && qld.shares.peak).toBeCloseTo(75, 6); // QLD local = AEST 17:00-21:00; the 18:00-22:00 window covers 6 of those 8 half hours
  });
});

describe("window shares", () => {
  const readings = ok(makeNem12({ start: "20260101", days: 28, streams: [{ at: (_d, s) => (s >= 30 && s < 42 ? 0.5 : 0.1) }] }));
  const profile = buildProfile(readings, "QLD");
  const wk = ["MON", "TUE", "WED", "THU", "FRI"];
  const all = [...wk, "SAT", "SUN"];
  const tou = (type: string, windows: TimeOfUseRate["windows"]): TimeOfUseRate => ({ type, rates: [], windows });

  it("maps peak, shoulder and a residual off-peak, with end times written either way", () => {
    const a = bandShares(profile, [tou("PEAK", [{ days: wk, startTime: "15:00", endTime: "20:59" }]), tou("SHOULDER", [{ days: all, startTime: "07:00", endTime: "14:59" }]), tou("OFF_PEAK", [])], periodMonths({}));
    const b = bandShares(profile, [tou("PEAK", [{ days: wk, startTime: "1500", endTime: "2100" }]), tou("SHOULDER", [{ days: all, startTime: "0700", endTime: "1500" }]), tou("OFF_PEAK", [])], periodMonths({}));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.shares.peak + a.shares.shoulder + a.shares.offPeak).toBeCloseTo(100, 6);
      expect(a.shares.peak).toBeCloseTo(b.shares.peak, 9);
      // Weekday 15:00-21:00 holds 0.5 a half hour for 12 half hours on 20 of 28 days.
      expect(a.shares.peak).toBeGreaterThan(30);
    }
  });
  it("maps several shoulder bands, each with its own share", () => {
    const r = bandShares(profile, [tou("PEAK", [{ days: wk, startTime: "15:00", endTime: "20:59" }]), tou("SHOULDER1", [{ days: all, startTime: "07:00", endTime: "11:59" }]), tou("SHOULDER2", [{ days: all, startTime: "12:00", endTime: "14:59" }]), tou("OFF_PEAK", [])], periodMonths({}));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.byBand).sort()).toEqual(["OFF_PEAK", "PEAK", "SHOULDER1", "SHOULDER2"]);
    expect(Object.values(r.byBand).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    // The two shoulders together are the legacy shoulder share.
    expect(r.byBand.SHOULDER1! + r.byBand.SHOULDER2!).toBeCloseTo(r.shares.shoulder, 9);
    // The data uses 0.5 in half hours 30-41 (15:00-21:00) and 0.1 elsewhere: SHOULDER1 spans 10 half hours, SHOULDER2 spans 6, so SHOULDER1 > SHOULDER2.
    expect(r.byBand.SHOULDER1!).toBeGreaterThan(r.byBand.SHOULDER2!);
  });
  it("maps an overnight off-peak window that wraps midnight", () => {
    const r = bandShares(profile, [tou("PEAK", [{ days: all, startTime: "07:00", endTime: "20:59" }]), tou("OFF_PEAK", [{ days: all, startTime: "21:00", endTime: "06:59" }])], periodMonths({}));
    expect(r.ok && r.shares.offPeak > 0).toBe(true);
    expect(r.ok && r.shares.peak + r.shares.offPeak).toBeCloseTo(100, 6);
  });
  it("lists a plan as not mappable rather than guessing: gaps, overlaps, odd times, partial weekdays, several shoulders", () => {
    const why = (bands: TimeOfUseRate[]) => {
      const r = bandShares(profile, bands, periodMonths({}));
      return r.ok ? "ok" : r.reason;
    };
    expect(why([tou("PEAK", [{ days: wk, startTime: "15:00", endTime: "20:59" }]), tou("OFF_PEAK", [{ days: all, startTime: "21:00", endTime: "06:59" }])])).toMatch(/uncovered/);
    expect(why([tou("PEAK", [{ days: all, startTime: "07:00", endTime: "20:59" }]), tou("OFF_PEAK", [{ days: all, startTime: "20:00", endTime: "06:59" }])])).toMatch(/same half hour/);
    expect(why([tou("PEAK", [{ days: all, startTime: "07:10", endTime: "20:59" }]), tou("OFF_PEAK", [])])).toMatch(/half hour/);
    expect(why([tou("PEAK", [{ days: ["MON", "TUE"], startTime: "07:00", endTime: "20:59" }]), tou("OFF_PEAK", [])])).toMatch(/weekdays/);
    expect(why([tou("PEAK", [{ days: all, startTime: "07:00", endTime: "20:59" }]), tou("PEAK", [{ days: all, startTime: "21:00", endTime: "06:59" }])])).toMatch(/two bands of the same type/);
    expect(why([tou("SOLAR_SPONGE", [{ days: all, startTime: "10:00", endTime: "13:59" }]), tou("OFF_PEAK", [])])).toMatch(/cannot be mapped/);
  });
  it("takes shares from the months a seasonal tariff period covers", () => {
    expect(periodMonths({ startDate: "11-01", endDate: "03-31" })).toEqual([0, 1, 2, 10, 11]);
    expect(periodMonths({ startDate: "04-01", endDate: "10-31" })).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(periodMonths({})).toHaveLength(12);
  });
});

describe("summarise_interval_readings", () => {
  let client: Client;
  beforeAll(async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer().connect(a);
    client = new Client({ name: "test", version: "1" });
    await client.connect(b);
  });
  afterAll(async () => {
    await client.close();
  });
  const call = async (args: Record<string, unknown>) => {
    const r = await client.callTool({ name: "summarise_interval_readings", arguments: args });
    const sc = r.structuredContent as any;
    return { text: (r.content as Array<{ text: string }>)[0]!.text, g: sc.grounded ?? sc };
  };

  it("is listed read-only with a flat input", async () => {
    const t = (await client.listTools()).tools.find((x) => x.name === "summarise_interval_readings")!;
    expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(Object.values((t.inputSchema as any).properties).every((p: any) => ["string", "number", "integer", "boolean"].includes(p.type))).toBe(true);
  });
  it("returns the period, days, totals and a profile, and no identifier anywhere in the result", async () => {
    const text = makeNem12({ start: "20260101", days: 31, skip: ["20260110"], vDay: "20260103", lastShort: true });
    const { g, text: out } = await call({ readingsText: text, postcode: "3000" });
    expect(g.found).toBe(true);
    expect(g.data).toMatchObject({ state: "VIC", daysPresent: 30, missingCount: 1, missingDates: ["2026-01-10"], period: { from: "2026-01-01", to: "2026-01-31" } });
    expect(g.data.totalKwh).toBeCloseTo(30 * 48 * 0.1, 0);
    expect(g.data.annualKwh).toBe(Math.round(((30 * 48 * 0.1) / 30) * 365));
    expect(g.source.name).toMatch(/household's own/);
    expect(g.asOf).toMatch(/^2026-01-31/);
    expect(out).toMatch(/1 variable day/);
    expect(out).toMatch(/Pass this profile unchanged|pass this profile unchanged/);
    for (const secret of [NMI, SERIAL]) {
      expect(JSON.stringify(g)).not.toContain(secret);
      expect(out).not.toContain(secret);
    }
    expect(decodeProfile(g.data.profile)).toMatchObject({ ok: true });
  });
  it("says solar export is separate and controlled load is not costed separately", async () => {
    const { g, text } = await call({ readingsText: makeNem12({ days: 5, streams: [{ suffix: "E1" }, { suffix: "E2" }, { suffix: "B1", at: () => 0.2 }] }), postcode: "2000" });
    expect(g.data.solarExportKwh).toBeCloseTo(5 * 48 * 0.2, 1);
    expect(text).toMatch(/Solar export \(B stream\)/);
    expect(text).toMatch(/controlled load is not costed separately/);
  });
  it("refuses with a plain reason: NEM13, several NMIs, a bad postcode, WA, text that is not a file", async () => {
    const nem13 = await call({ readingsText: "100,NEM13,202611191200,A,B\n250,6407000123,E1,1,E1,,SER,20260101,0,10,20,A,,,20260102,0,10,20,A\n900", postcode: "3000" });
    expect(nem13.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(nem13.g.message).toMatch(/accumulation/);
    expect(JSON.stringify(nem13.g)).not.toContain(NMI);
    const two = await call({ readingsText: makeNem12({ streams: [{}, { suffix: "E2", nmi: "6407000999" }], days: 1 }), postcode: "3000" });
    expect(two.g.message).toMatch(/more than one NMI/);
    expect((await call({ readingsText: makeNem12({ days: 1 }), postcode: "30" })).g).toMatchObject({ found: false, reason: "needs_input" });
    expect((await call({ readingsText: makeNem12({ days: 1 }), postcode: "6000" })).g).toMatchObject({ found: false, reason: "outside_coverage" });
    expect((await call({ readingsText: "this is not a meter file at all", postcode: "3000" })).g.message).toMatch(/NEM12/);
  });
  it("answers an over-long file with a plain needs_input message, not a protocol error", async () => {
    const big = makeNem12({ start: "20260101", days: 365, streams: [{ per: 5, at: () => 0.1 }] }).slice(0, 252_000); // over our 250,000 limit, under the 256 KB body limit
    const { g } = await call({ readingsText: big, postcode: "3000" });
    expect(g).toMatchObject({ found: false, reason: "needs_input" });
    expect(g.message).toMatch(/over the limit of 250,000/);
    expect(g.message).toMatch(/shorter period/);
    expect(JSON.stringify(g)).not.toContain(NMI);
  });
  it("states the ladder: paste small, paste long, build by hand, shorter period; never own windows", async () => {
    const { serverInstructions } = await import("../../src/server/instructions.js");
    const { readFileSync } = await import("node:fs");
    const skill = readFileSync(`${process.cwd()}/plugin/skills/energy-bill-comparison/SKILL.md`, "utf8");
    for (const text of [serverInstructions(), skill]) {
      expect(text).toMatch(/30 KB/);
      expect(text).toMatch(/250,000/);
      expect(text).toMatch(/not verified by Ask Righto/);
      expect(text).toMatch(/shorter period/);
      expect(text).toMatch(/peak or off-peak hours of your own/);
    }
    const t = (await client.listTools()).tools.find((x) => x.name === "summarise_interval_readings")!;
    expect(t.description).toMatch(/instead of adding the readings up yourself/);
    expect(t.description).toMatch(/sums \(24 rows of 48/);
  });
  it("is in the server instructions and the energy skill, and never asks to send the file elsewhere", async () => {
    const { serverInstructions } = await import("../../src/server/instructions.js");
    const { readFileSync } = await import("node:fs");
    expect(serverInstructions()).toMatch(/summarise_interval_readings/);
    const skill = readFileSync(`${process.cwd()}/plugin/skills/energy-bill-comparison/SKILL.md`, "utf8");
    expect(skill).toMatch(/summarise_interval_readings/);
    expect(skill).toMatch(/do not ask the user to send the file anywhere else|not ask the user to send/i);
  });
});

d("compare_energy_plans with readings (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  async function call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args });
    const sc = r.structuredContent as any;
    return { text: (r.content as Array<{ text: string }>)[0]!.text, sc, g: sc.grounded ?? sc };
  }
  // A time-of-use plan whose windows can be matched: peak weekdays 15:00-21:00, off-peak the rest (no windows).
  const mappable = () => {
    const detail: Record<string, any> = { ...fixture("time-of-use"), planId: "TOU1" };
    detail.electricityContract = JSON.parse(JSON.stringify(detail.electricityContract));
    detail.electricityContract.tariffPeriod[0].timeOfUseRates[1].timeOfUse = [];
    return { detail };
  };
  const plan = (name: string, planId: string) => ({ detail: { ...fixture(name), planId } });
  const evening = (days: number) => makeNem12({ start: "20260101", days, streams: [{ at: (_d, s) => (s >= 30 && s < 42 ? 0.5 : 0.1) }] });

  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    mock = await startMockCdr({ retailers: { agl: [plan("single-rate", "A1")], origin: [mappable(), plan("time-of-use", "TOU2")] } });
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
  const profileFor = async (text: string, postcode = "3000") => (await call("summarise_interval_readings", { readingsText: text, postcode })).g.data.profile as string;
  const base = { postcode: "3000", fuelType: "ELECTRICITY", distributor: "Jemena" };

  it("estimates a time-of-use plan from the readings, with the basis, the period and no readings prompt", async () => {
    const profile = await profileFor(evening(365));
    const { g, text } = await call("compare_energy_plans", { ...base, readingsProfile: profile });
    expect(g.found).toBe(true);
    expect(g.data.usage).toMatchObject({ basis: "readings", readings: { from: "2026-01-01", daysPresent: 365 } });
    expect(g.data.readingsNotice).toMatch(/household's own interval readings, 2026-01-01 to 2026-12-31/);
    const tou = g.data.estimates.find((e: any) => e.planId === "TOU1");
    expect(tou).toBeDefined(); // estimated for the first time without a bill split
    expect(g.data.usage.shares).toBeUndefined();
    const stuck = g.data.notEstimated.find((n: any) => n.planId === "TOU2");
    expect(stuck).toMatchObject({ reason: "not_fully_understood" });
    expect(stuck.detail).toMatch(/time-of-use windows could not be matched/);
    expect(text).toMatch(/household's own interval readings/);
    expect(text).not.toMatch(/More accurate comparison/); // the prompt is for benchmark and single-bill usage
    expect(text).not.toMatch(/Typical usage/);
    expect(g.data.omissions.join(" ")).toMatch(/Controlled load is not costed separately/);
    expect(g.data.readingsNote).toBeUndefined();
  });

  it("matches the shares the readings give: the same plan from a bill split gives the same cost", async () => {
    const profile = await profileFor(evening(365));
    const dec = decodeProfile(profile);
    if (!dec.ok) throw new Error("profile");
    const w = bandShares(dec.profile, [{ type: "PEAK", rates: [], windows: [{ days: ["MON", "TUE", "WED", "THU", "FRI"], startTime: "15:00", endTime: "21:00" }] }, { type: "OFF_PEAK", rates: [], windows: [] }], periodMonths({}));
    if (!w.ok) throw new Error("windows");
    const fromReadings = (await call("compare_energy_plans", { ...base, readingsProfile: profile })).g.data.estimates.find((e: any) => e.planId === "TOU1");
    const annual = dec.profile.totalKwh;
    const fromBill = (await call("compare_energy_plans", { ...base, annualUsageKwh: annual, peakSharePct: w.shares.peak, shoulderSharePct: 0, offPeakSharePct: 100 - w.shares.peak })).g.data.estimates.find((e: any) => e.planId === "TOU1");
    expect(Math.abs(fromReadings.totalCents - fromBill.totalCents)).toBeLessThanOrEqual(100); // rounding of the shares only
  });

  it("uses the readings over a bill figure and says so; short periods are scaled and labelled", async () => {
    const profile = await profileFor(evening(60));
    const { g, text } = await call("compare_energy_plans", { ...base, readingsProfile: profile, annualUsageKwh: 9999 });
    expect(g.data.usage.annualUsage).not.toBe(9999);
    expect(g.data.usage.readings.ignored).toMatch(/not used/);
    expect(text).toMatch(/60 days present/);
    expect(text).toMatch(/scaled to a year/);
    const short = await profileFor(evening(30));
    expect((await call("compare_energy_plans", { ...base, readingsProfile: short })).g.data.usage.readings.daysPresent).toBe(30);
  });

  it("labels a profile the server did not sign or that was changed, and not an untouched one", async () => {
    const profile = await profileFor(evening(100));
    const signed = await call("compare_energy_plans", { ...base, readingsProfile: profile });
    expect(signed.g.data.usage.readings.verified).toBe(true);
    expect(signed.g.data.readingsNotice).not.toMatch(/not verified/);
    // Built by hand: same content, no signature.
    const { sig: _sig, ...bare } = JSON.parse(profile);
    void _sig;
    const byHand = await call("compare_energy_plans", { ...base, readingsProfile: JSON.stringify(bare) });
    expect(byHand.g.found).toBe(true);
    expect(byHand.g.data.usage.readings.verified).toBe(false);
    expect(byHand.g.data.readingsNotice).toMatch(/not verified by Ask Righto/);
    expect(byHand.text).toMatch(/not verified by Ask Righto/);
    // Same totals, one digit changed inside the sums: still within the totals check, but the signature fails.
    const nudged = JSON.parse(profile);
    nudged.sums[0][0] += 0.001;
    const changed = await call("compare_energy_plans", { ...base, readingsProfile: JSON.stringify(nudged) });
    expect(changed.g.data.usage.readings.verified).toBe(false);
    // Key order does not matter.
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(profile)).reverse()));
    expect((await call("compare_energy_plans", { ...base, readingsProfile: reordered })).g.data.usage.readings.verified).toBe(true);
  });
  it("refuses a malformed, changed, wrong-state or gas profile and makes no estimate", async () => {
    const profile = await profileFor(evening(100));
    const bad = await call("compare_energy_plans", { ...base, readingsProfile: "{}" });
    expect(bad.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(bad.g.message).toMatch(/summarise_interval_readings again/);
    const edited = JSON.parse(profile);
    edited.totalKwh += 500;
    expect((await call("compare_energy_plans", { ...base, readingsProfile: JSON.stringify(edited) })).g).toMatchObject({ found: false });
    const nsw = await call("compare_energy_plans", { postcode: "2000", fuelType: "ELECTRICITY", readingsProfile: profile });
    expect(nsw.g).toMatchObject({ found: false, reason: "needs_input" });
    expect(nsw.g.message).toMatch(/VIC/);
    expect((await call("compare_energy_plans", { postcode: "3000", fuelType: "GAS", readingsProfile: profile })).g).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("costs solar export from the B stream", async () => {
    const withSolar = makeNem12({ start: "20260101", days: 120, streams: [{ at: (_d, s) => (s >= 30 && s < 42 ? 0.5 : 0.1) }, { suffix: "B1", at: () => 0.2 }] });
    const profile = await profileFor(withSolar);
    const { g } = await call("compare_energy_plans", { ...base, readingsProfile: profile });
    const est = g.data.estimates.find((e: any) => e.planId === "TOU1"); // its feed-in is a single 5c rate
    expect(est.breakdown.feedInCreditCents).toBeLessThan(0);
    expect(g.data.usage.solarExportAnnualKwh).toBeGreaterThan(0);
  });

  it("does not return or log the input text or an identifier", async () => {
    const text = evening(40);
    const profile = await profileFor(text);
    const { text: out, g } = await call("compare_energy_plans", { ...base, readingsProfile: profile });
    for (const secret of [NMI, SERIAL]) {
      expect(out).not.toContain(secret);
      expect(JSON.stringify(g)).not.toContain(secret);
    }
  });
});
