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
    const d = generateNem12Data({ start: "2026-03-01", days: 91, consumptionKwh: 1234.5678, feedinKwh: 321.0987, controlledLoadStreams: 2, solarStreams: 2, seed: 3 });
    expect(d.streams.map((s) => s.suffix)).toEqual(["E1", "E2", "E3", "B1", "B2"]);
    expect(sumStream(d, (s) => s.startsWith("E"))).toBeCloseTo(1234.5678, 4);
    expect(sumStream(d, (s) => s.startsWith("B"))).toBeCloseTo(321.0987, 4);
  });
  it("puts about the asked share on controlled load, overnight", () => {
    const d = generateNem12Data({ start: "2026-06-01", days: 30, consumptionKwh: 400, controlledLoadStreams: 1, controlledLoadShare: 0.25 });
    const e2 = sumStream(d, (s) => s === "E2");
    expect(e2).toBeCloseTo(100, 4);
    const day = d.streams[1]!.days[0]!.values;
    const night = day.slice(0, 12).reduce((a, b) => a + b, 0) + day.slice(46).reduce((a, b) => a + b, 0);
    expect(night / day.reduce((a, b) => a + b, 0)).toBeGreaterThan(0.9);
  });
  it("makes solar zero at night and larger in summer than winter", () => {
    const d = generateNem12Data({ start: "2026-01-01", days: 365, feedinKwh: 3000, seed: 5 });
    const b = d.streams.find((s) => s.suffix === "B1")!;
    for (const day of b.days) expect(day.values[0]! + day.values[1]! + day.values[46]! + day.values[47]!).toBe(0);
    const month = (m: number) => b.days.filter((x) => +x.date.slice(4, 6) === m).reduce((a, x) => a + x.values.reduce((c, v) => c + v, 0), 0) / b.days.filter((x) => +x.date.slice(4, 6) === m).length;
    expect(month(1)).toBeGreaterThan(month(6));
  });
  it("loads more in winter and summer than in spring or autumn", () => {
    const d = generateNem12Data({ start: "2026-01-01", days: 365, dailyKwh: 12, seed: 2 });
    const e1 = d.streams[0]!.days;
    const avg = (m: number) => e1.filter((x) => +x.date.slice(4, 6) === m).reduce((a, x) => a + x.values.reduce((c, v) => c + v, 0), 0) / e1.filter((x) => +x.date.slice(4, 6) === m).length;
    expect(avg(7)).toBeGreaterThan(avg(10));
    expect(avg(1)).toBeGreaterThan(avg(4));
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
