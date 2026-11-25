/** The seeded NEM12 test generator: deterministic, exact totals, parseable by our own parser. No database. */
import { describe, expect, it } from "vitest";
import { parseNem12 } from "../../src/energy/readings/parse.js";
import { generateNem12, generateNem12Data } from "../helpers/nem12.js";

const sumStream = (d: ReturnType<typeof generateNem12Data>, pick: (s: string) => boolean) =>
  d.streams.filter((s) => pick(s.suffix)).reduce((a, s) => a + s.days.reduce((b, x) => b + x.values.reduce((c, v) => c + Math.round(v * 1e4), 0), 0), 0) / 1e4;

describe("generateNem12", () => {
  it("is deterministic for a seed and differs between seeds", () => {
    const a = generateNem12({ start: "2026-01-01", days: 10, seed: 7 });
    expect(generateNem12({ start: "20260101", days: 10, seed: 7 })).toBe(a);
    expect(generateNem12({ start: "2026-01-01", days: 10, seed: 8 })).not.toBe(a);
  });
  it("needs a start date and uses the invented NMI by default", () => {
    expect(() => generateNem12({} as never)).toThrow(/start/);
    expect(() => generateNem12({ start: "yesterday" })).toThrow(/start/);
    expect(generateNem12({ start: "2026-01-01", days: 1 })).toContain("200,6407000123,E1,");
  });
  it("hits the consumption and feed-in totals exactly, controlled load and solar included", () => {
    const d = generateNem12Data({ start: "2026-03-01", days: 91, consumptionKwh: 1234.568, feedinKwh: 321.099, controlledLoadStreams: 2, solarStreams: 2, seed: 3 });
    expect(d.streams.map((s) => s.suffix)).toEqual(["B1", "B2", "E1", "E2", "E3"]); // B before E, as the original orders them
    expect(sumStream(d, (s) => s.startsWith("E"))).toBeCloseTo(1234.568, 6);
    expect(sumStream(d, (s) => s.startsWith("B"))).toBeCloseTo(321.099, 6);
  });
  it("writes the config string, the 500 register index and the header and trailer", () => {
    const text = generateNem12({ start: "2026-03-01", days: 5, consumptionKwh: 50, feedinKwh: 10, controlledLoadStreams: 1, openingIndex: 100, seed: 3 });
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^100,NEM12,\d{12},ACTIVMDP,ENGYAVIC$/);
    expect(lines.filter((l) => l.startsWith("200,")).map((l) => l.split(",")[2])).toEqual(["B1E1E2", "B1E1E2", "B1E1E2"]);
    expect(lines.filter((l) => l.startsWith("500,"))).toHaveLength(3);
    expect(lines.at(-1)).toBe("900");
    const idx = lines.filter((l) => l.startsWith("500,")).map((l) => Number(l.split(",")[4]));
    expect(idx[0]).toBeCloseTo(110, 3); // B1: 100 + 10 kWh
  });
  it("runs controlled load 23:00 to 07:00 only", () => {
    const d = generateNem12Data({ start: "2026-06-01", days: 30, consumptionKwh: 400, controlledLoadStreams: 1 });
    const day = d.streams.find((s) => s.suffix === "E2")!.days[0]!.values;
    expect(day.slice(14, 46).every((v) => v === 0)).toBe(true);
    expect(day.slice(0, 14).some((v) => v > 0)).toBe(true);
  });
  it("makes solar zero at night, larger in summer than winter, and exports only what the household does not use", () => {
    const d = generateNem12Data({ start: "2026-01-01", days: 365, feedinKwh: 3000, seed: 5 });
    const b = d.streams.find((s) => s.suffix === "B1")!;
    for (const day of b.days) expect(day.values[0]! + day.values[1]! + day.values[46]! + day.values[47]!).toBe(0);
    const month = (m: number) => b.days.filter((x) => +x.date.slice(4, 6) === m).reduce((a, x) => a + x.values.reduce((c, v) => c + v, 0), 0) / b.days.filter((x) => +x.date.slice(4, 6) === m).length;
    expect(month(1)).toBeGreaterThan(month(6));
  });
  it("loads more in winter than in spring, from heating, and more on weekday evenings", () => {
    const d = generateNem12Data({ start: "2026-01-01", days: 365, seed: 2 });
    const e1 = d.streams.find((s) => s.suffix === "E1")!.days;
    const avg = (m: number) => e1.filter((x) => +x.date.slice(4, 6) === m).reduce((a, x) => a + x.values.reduce((c, v) => c + v, 0), 0) / e1.filter((x) => +x.date.slice(4, 6) === m).length;
    expect(avg(7)).toBeGreaterThan(avg(10));
    const day = e1[0]!.values;
    expect(day.slice(36, 42).reduce((a, b) => a + b, 0)).toBeGreaterThan(day.slice(24, 30).reduce((a, b) => a + b, 0));
  });
  it("is read by our parser, at 30 and 5 minutes, with the same half-hour totals", () => {
    const a = generateNem12Data({ start: "2026-01-01", days: 14, consumptionKwh: 168, feedinKwh: 40, controlledLoadStreams: 1, seed: 9 });
    const five = generateNem12Data({ start: "2026-01-01", days: 14, consumptionKwh: 168, feedinKwh: 40, controlledLoadStreams: 1, seed: 9, intervalMinutes: 5 });
    expect(five.streams[0]!.days[0]!.values).toHaveLength(288);
    for (const d of [a, five]) {
      const p = parseNem12(d.text);
      if (!p.ok) throw new Error(p.problem);
      const total = [...p.consumption.values()].reduce((x, v) => x + v.reduce((y, z) => y + z, 0), 0);
      const exp = [...p.exportKwh.values()].reduce((x, v) => x + v.reduce((y, z) => y + z, 0), 0);
      expect(total).toBeCloseTo(168, 3);
      expect(exp).toBeCloseTo(40, 3);
      expect(p.streamsUsed).toEqual({ consumption: ["E1", "E2"], export: ["B1"] });
    }
  });
});
