import { describe, expect, it } from "vitest";
import { describeLayout, layoutId, layoutWindows } from "../../src/energy/layouts.js";
import { normalisePlan, readListItem } from "../../src/energy/normalise.js";
import type { EnergyPlan } from "../../src/energy/types.js";
import { fixture } from "./mock-cdr.js";

const plan = (name: string): EnergyPlan => {
  const d = fixture(name);
  return { ...normalisePlan("x", readListItem(d)!, d).plan, fetchedAt: "", verifiedAt: "" };
};

describe("band-hour layouts", () => {
  it("has none for a single rate plan", () => {
    expect(layoutWindows(plan("single-rate"))).toBeUndefined();
  });

  it("lists the windows of a time-of-use plan and describes them in plain words", () => {
    const w = layoutWindows(plan("time-of-use"))!;
    expect(w.length).toBeGreaterThan(1);
    expect(w.map((x) => x.band)).toEqual(expect.arrayContaining(["PEAK", "OFF_PEAK"]));
    const text = describeLayout(w);
    expect(text).toMatch(/Peak .* on /);
    expect(text).toMatch(/Off-peak/);
    expect(text).toMatch(/pm|am|midnight/);
  });

  it("gives equal hours the same id however the windows are ordered, and different hours a different id", () => {
    const a = layoutWindows(plan("time-of-use"))!;
    const reversed = [...a].reverse().sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    expect(layoutId(reversed)).toBe(layoutId(a));
    const shifted = a.map((x) => (x.band === "PEAK" ? { ...x, start: "16:00" } : x));
    expect(layoutId(shifted)).not.toBe(layoutId(a));
    expect(layoutId(a)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("says weekdays, weekends and every day in words, and midnight for 00:00", () => {
    const w = [
      { season: "year", band: "PEAK", days: "MON,TUE,WED,THU,FRI", start: "15:00", end: "21:00" },
      { season: "year", band: "SHOULDER", days: "SAT,SUN", start: "07:00", end: "22:00" },
      { season: "year", band: "OFF_PEAK", days: "MON,TUE,WED,THU,FRI,SAT,SUN", start: "21:00", end: "00:00" },
    ];
    expect(describeLayout(w)).toBe("Peak 3pm to 9pm on weekdays; Shoulder 7am to 10pm on weekends; Off-peak 9pm to midnight on every day");
  });

  it("names seasons when there is more than one", () => {
    const w = [
      { season: "11-01 to 03-31", band: "PEAK", days: "MON", start: "15:00", end: "21:00" },
      { season: "04-01 to 10-31", band: "PEAK", days: "MON", start: "17:00", end: "20:00" },
    ];
    expect(describeLayout(w)).toMatch(/11-01 to 03-31: Peak .* \| 04-01 to 10-31: Peak/);
  });
});
