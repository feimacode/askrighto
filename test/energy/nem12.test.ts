import { describe, expect, it } from "vitest";
import { parseNem12, ReadingsError } from "../../src/energy/readings/nem12.js";
import { annualKwh, buildProfile, decodeProfile, encodeProfile } from "../../src/energy/readings/profile.js";
import { localOffsetMinutes, windowShares, WindowError } from "../../src/energy/readings/windows.js";
import type { TimeOfUseRate } from "../../src/energy/types.js";
import { datesFrom, FAKE_NMI, FAKE_SERIAL, makeNem12 } from "./nem12-fixture.js";

const week = datesFrom("2026-01-05", 14); // Mon 5 Jan to Sun 18 Jan 2026

describe("parseNem12", () => {
  it("reads a real-export shape: no 100/900, short last line, V day with 400 events", () => {
    const text = makeNem12({
      dates: week,
      streams: [{ suffix: "E1", flag: (d) => (d === "2026-01-07" ? "V" : "A"), events: (d) => (d === "2026-01-07" ? ["400,1,6,A,,", "400,7,7,A,79,", "400,8,48,A,,"] : []) }],
      shortLast: true,
    });
    const p = parseNem12(text);
    expect(p.start).toBe("2026-01-05");
    expect(p.end).toBe("2026-01-18");
    expect(p.daysPresent).toBe(14);
    expect(p.quality.dayFlags).toEqual({ A: 13, V: 1 });
    expect(p.quality.outageEvents).toBe(1);
    expect(p.streams.consumption).toEqual(["E1"]);
  });

  it("lists a missing day and does not fill it", () => {
    const p = parseNem12(makeNem12({ dates: week, skip: ["2026-01-10"], streams: [{ suffix: "E1" }] }));
    expect(p.daysPresent).toBe(13);
    expect(p.missingDates).toEqual(["2026-01-10"]);
  });

  it("sums E streams as consumption and B streams as export, and never adds check or average variants", () => {
    const p = parseNem12(makeNem12({ dates: week, header: true, streams: [{ suffix: "E1" }, { suffix: "E2" }, { suffix: "B1", value: () => 0.1 }, { suffix: "F1" }, { suffix: "C1" }] }));
    expect(p.streams.consumption).toEqual(["E1", "E2"]);
    expect(p.streams.export).toEqual(["B1"]);
    const day = p.consumption.get("2026-01-05")!;
    expect(day[0]).toBeCloseTo(0.5);
    expect(p.exportKwh.get("2026-01-05")![0]).toBeCloseTo(0.1);
    expect(p.streams.ignored).toEqual(expect.arrayContaining(["F1", "C1"]));
  });

  it("accepts a net-only file and says so", () => {
    const p = parseNem12(makeNem12({ dates: week, streams: [{ suffix: "N1" }] }));
    expect(p.netOnly).toBe(true);
    expect(p.exportKwh.size).toBe(0);
  });

  it("ignores reactive power streams and converts Wh", () => {
    const p = parseNem12(makeNem12({ dates: week, streams: [{ suffix: "E1", unit: "WH", value: () => 250 }, { suffix: "Q1", unit: "KVARH" }] }));
    expect(p.consumption.get("2026-01-05")![0]).toBeCloseTo(0.25);
    expect(p.streams.ignored).toContain("Q1");
  });

  it("sums 5 and 15 minute intervals to half hours", () => {
    for (const interval of [5, 15] as const) {
      const p = parseNem12(makeNem12({ dates: week, streams: [{ suffix: "E1", interval }] }));
      expect(p.consumption.get("2026-01-05")![10]).toBeCloseTo(0.25, 2);
    }
  });

  it("refuses NEM13, several NMIs, no consumption stream, non-numbers and repeated dates", () => {
    expect(() => parseNem12("100,NEM13,2003,A,B\n250,1234567890,1141,01,11,11,M,E,0,2003,A,,,0,2004\n900")).toThrow(/accumulation/);
    const a = makeNem12({ dates: week, streams: [{ suffix: "E1" }] });
    const b = makeNem12({ dates: week, nmi: "4009999999", streams: [{ suffix: "E1" }] });
    expect(() => parseNem12(`${a}\n${b}`)).toThrow(/more than one NMI/);
    expect(() => parseNem12(makeNem12({ dates: week, streams: [{ suffix: "B1" }] }))).toThrow(/no consumption/);
    expect(() => parseNem12(makeNem12({ dates: week, streams: [{ suffix: "E1" }] }).replace("0.250", "abc"))).toThrow(/not a number/);
    expect(() => parseNem12(makeNem12({ dates: [week[0]!, week[0]!], streams: [{ suffix: "E1" }] }))).toThrow(/twice/);
    expect(() => parseNem12("hello world")).toThrow(ReadingsError);
  });

  it("refuses text over the size cap without truncating", () => {
    expect(() => parseNem12("x".repeat(101), 100)).toThrow(/size limit/);
  });

  it("names the line and never repeats the content of a bad line", () => {
    const text = makeNem12({ dates: week, streams: [{ suffix: "E1" }] }).replace("0.250", "SECRET-VALUE");
    try {
      parseNem12(text);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toMatch(/Line \d+/);
      expect((e as Error).message).not.toContain("SECRET-VALUE");
    }
  });
});

describe("profile", () => {
  const text = makeNem12({ dates: datesFrom("2026-01-01", 60), streams: [{ suffix: "E1" }, { suffix: "B1", value: () => 0.05 }] });
  const parsed = parseNem12(text);
  const profile = buildProfile(parsed);

  it("carries no identifier and round-trips", () => {
    const s = encodeProfile(profile);
    expect(s).not.toContain(FAKE_NMI);
    expect(s).not.toContain(FAKE_SERIAL);
    expect(decodeProfile(s)).toEqual(profile);
  });

  it("scales a part year by days present", () => {
    expect(annualKwh(profile)).toBeCloseTo(12 * 365, 0); // 0.25 x 48 = 12 kWh a day
  });

  it("rejects malformed, unknown-version and out-of-range profiles", () => {
    expect(decodeProfile("not json")).toBeUndefined();
    expect(decodeProfile(JSON.stringify({ ...profile, v: 2 }))).toBeUndefined();
    expect(decodeProfile(JSON.stringify({ ...profile, kwh: -1 }))).toBeUndefined();
  });
});

const rate = (type: string, windows: TimeOfUseRate["windows"]): TimeOfUseRate => ({ type, rates: [{ unitPrice: 1, measureUnit: "KWH" }], windows });
const ALL = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

describe("windowShares", () => {
  // Use is 1 kWh in the half hour starting at 17:00 and 17:30 market time (AEST) on every day, otherwise 0.
  const dates = datesFrom("2026-01-01", 365);
  const text = makeNem12({ dates, streams: [{ suffix: "E1", value: (_d, k) => (k === 34 || k === 35 ? 1 : 0) }] });
  const profile = buildProfile(parseNem12(text));
  const peak = rate("PEAK", [{ days: ALL, startTime: "16:00", endTime: "21:00" }]);
  const off = rate("OFF_PEAK", [{ days: ALL, startTime: "21:00", endTime: "16:00" }]);

  it("puts all use in the peak in a state with no daylight saving", () => {
    const [p, o] = windowShares(profile, "QLD", [peak, off], {});
    expect(p).toBeCloseTo(1);
    expect(o).toBeCloseTo(0);
  });

  it("shifts the window by an hour in summer for a daylight saving state", () => {
    // 17:00 AEST is 18:00 local in summer, still inside 16:00 to 21:00; use a 17:30-18:30 local peak to see the shift.
    const narrow = rate("PEAK", [{ days: ALL, startTime: "18:00", endTime: "19:00" }]);
    const rest = rate("OFF_PEAK", [{ days: ALL, startTime: "19:00", endTime: "18:00" }]);
    const vic = windowShares(profile, "VIC", [narrow, rest], {});
    const qld = windowShares(profile, "QLD", [narrow, rest], {});
    expect(qld[0]).toBeCloseTo(0); // 17:00 to 18:00 in QLD is outside 18:00 to 19:00
    expect(vic[0]).toBeGreaterThan(0.4); // in daylight saving months 17:00 AEST is 18:00 local
    expect(vic[0]).toBeLessThan(0.6); // but not in winter months
  });

  it("knows the offsets: QLD none, SA half an hour either side, others an hour in summer", () => {
    expect(localOffsetMinutes("QLD", 1, 15)).toBe(0);
    expect(localOffsetMinutes("NSW", 1, 15)).toBe(60);
    expect(localOffsetMinutes("NSW", 7, 15)).toBe(0);
    expect(localOffsetMinutes("SA", 1, 15)).toBe(30);
    expect(localOffsetMinutes("SA", 7, 15)).toBe(-30);
  });

  it("restricts a seasonal period to its own dates", () => {
    const summer = windowShares(profile, "QLD", [peak, off], { startDate: "12-01", endDate: "02-28" });
    expect(summer[0]).toBeCloseTo(1);
  });

  it("refuses overlapping or uncovered windows and day sets it cannot match", () => {
    expect(() => windowShares(profile, "QLD", [peak, off, peak], {})).toThrow(/overlap/);
    expect(() => windowShares(profile, "QLD", [peak], {})).toThrow(/uncovered/);
    const mon = rate("PEAK", [{ days: ["MON"], startTime: "00:00", endTime: "24:00" }]);
    expect(() => windowShares(profile, "QLD", [mon, off], {})).toThrow(WindowError);
    const hol = rate("PEAK", [{ days: ["PUBLIC_HOLIDAYS"], startTime: "00:00", endTime: "24:00" }]);
    expect(() => windowShares(profile, "QLD", [hol, off], {})).toThrow(WindowError);
  });
});

describe("committed sample", () => {
  it("reads the sample file in the real export layout", async () => {
    const { readFileSync } = await import("node:fs");
    const p = parseNem12(readFileSync("test/fixtures/readings/sample-nem12.csv", "utf8"));
    expect(p.daysPresent).toBe(3);
    expect(p.missingDates).toEqual(["2026-01-07"]);
    expect(p.streams).toMatchObject({ consumption: ["E1"], export: ["B1"] });
    expect(p.quality.outageEvents).toBe(1);
  });
});
