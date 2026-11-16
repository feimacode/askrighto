import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  levelGroupOf,
  parseIntlCricos,
  parseLocation,
} from "../../src/intl/parse.js";
import { FIXTURE } from "./helpers.js";

const parsed = () => parseIntlCricos(readFileSync(FIXTURE, "utf8"));

describe("CRICOS international parser", () => {
  it("keeps higher-education levels and counts what it leaves out", () => {
    const r = parsed();
    expect(r.problems).toEqual([]);
    expect(r.courses.map((c) => c.cricosCode).sort()).toEqual([
      "000001A",
      "000002B",
      "000003C",
      "000004D",
      "000005E",
      "000006F",
    ]);
    expect(r.report.excludedByLevel).toEqual({
      Diploma: 1,
      "Senior Secondary": 1,
    });
    expect(r.report.duplicateCodes).toEqual(["000001A"]);
  });
  it("stores fees and durations as published and leaves missing ones unset", () => {
    const r = parsed();
    const sci = r.courses.find((c) => c.cricosCode === "000001A")!;
    expect(sci).toMatchObject({
      durationWeeks: 156,
      tuitionFeeTotal: 132000,
      nonTuitionFee: 1500,
      levelGroup: "bachelor",
      expired: false,
    });
    const arts = r.courses.find((c) => c.cricosCode === "000003C")!;
    expect(arts.tuitionFeeTotal).toBeUndefined();
    expect(arts.nonTuitionFee).toBeUndefined();
    expect(
      r.courses.find((c) => c.cricosCode === "000006F")!.durationWeeks,
    ).toBeUndefined();
    expect(r.report).toMatchObject({
      withoutFee: 1,
      withoutDuration: 1,
      withoutLocation: 1,
    });
  });
  it("reads locations with states, work component and expiry", () => {
    const r = parsed();
    expect(
      r.courses.find((c) => c.cricosCode === "000002B")!.locations,
    ).toEqual([
      { campus: "Parkville", state: "VIC" },
      { campus: "Sydney", state: "NSW" },
    ]);
    expect(r.courses.find((c) => c.cricosCode === "000005E")).toMatchObject({
      workComponent: true,
      expired: true,
    });
  });
  it("reports columns it could not find and refuses a file without the key ones", () => {
    expect(parsed().report.columnsMissing).toEqual([]);
    expect(parseIntlCricos("a,b\n1,2").problems.length).toBeGreaterThan(0);
    const r = parseIntlCricos(
      "Course Code,Provider Code,Course Name,Course Level\n1A,P1,Bachelor of X,Bachelor Degree",
    );
    expect(r.problems).toEqual([]);
    expect(r.report.columnsMissing).toContain("tuitionFee");
    expect(r.courses[0]!.tuitionFeeTotal).toBeUndefined();
  });
  it("groups levels and parses location styles", () => {
    expect(levelGroupOf("Masters Degree (Research)")).toBe("master");
    expect(levelGroupOf("Doctoral Degree")).toBe("doctorate");
    expect(levelGroupOf("ELICOS")).toBeUndefined();
    expect(parseLocation("VIC: Clayton")).toEqual({
      state: "VIC",
      campus: "Clayton",
    });
    expect(parseLocation("Clayton, VIC")).toEqual({
      state: "VIC",
      campus: "Clayton",
    });
    expect(parseLocation("Somewhere")).toEqual({
      state: "",
      campus: "Somewhere",
    });
  });
});
