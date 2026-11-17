import { describe, expect, it } from "vitest";
import { parseProjectionRows, parseProjectionsFile } from "../../src/careers/parse.js";
import { FIXTURE } from "./helpers.js";

describe("career projections parser", () => {
  it("reads the unit group sheet from a workbook with title rows, a header split over two rows (sub-header below) and footnotes", async () => {
    const r = await parseProjectionsFile(FIXTURE);
    expect(r.report.problems).toEqual([]);
    expect(r.baselineLabel).toBe("May 2025");
    expect(r.midLabel).toBe("May 2030");
    expect(r.endLabel).toBe("May 2035");
    expect(r.classification).toBe("ANZSCO 1.3");
    expect(r.report.unitGroups).toBe(4);
    expect(r.report.nfdRows).toBe(1);
    expect(r.fileHash).toMatch(/^[0-9a-f]{64}$/);
    const nurse = r.occupations.find((o) => o.code === "2411")!;
    expect(nurse).toMatchObject({ level: 4, nfd: false, skillLevel: "1", baselineK: 300.25, endK: 360.75, change10Pct: 0.2015 });
  });

  it("keeps codes as text, keeps negatives, and leaves a missing value out instead of inventing one", async () => {
    const r = await parseProjectionsFile(FIXTURE);
    const printing = r.occupations.find((o) => o.code === "8995")!;
    expect(printing.change5K).toBe(-0.111);
    const small = r.occupations.find((o) => o.code === "8996")!;
    expect(small.baselineK).toBeUndefined();
    expect(small.change5Pct).toBeUndefined();
    expect(r.report.rowsWithoutEmployment).toBe(1);
    expect(typeof r.occupations[0]!.code).toBe("string");
  });

  it("also reads a single-row header followed directly by data", () => {
    const head = ["Occupation Level", "NFD Indicator", "ANZSCO Code", "Occupation", "Skill level", "Baseline May 2025 ('000)", "Projected May 2030 ('000)", "Projected May 2035 ('000)", "5-Year Change Level ('000)", "5-Year Change %", "10-Year Change Level ('000)", "10-Year Change %"];
    const r = parseProjectionRows([head, [4, "N", "1111", "Test Occupation", "1", 1, 2, 3, 1, 1, 2, 2]]);
    expect(r.report.problems).toEqual([]);
    expect(r.occupations).toHaveLength(1);
    expect(r.midLabel).toBe("May 2030");
  });

  it("reports a missing header and a missing column rather than loading guesses", () => {
    expect(parseProjectionRows([["nothing here"]]).report.problems[0]).toMatch(/ANZSCO Code/);
    const noEmployment = parseProjectionRows([["Occupation Level", "NFD Indicator", "ANZSCO Code", "Occupation"], [4, "N", "1111", "X"]]);
    expect(noEmployment.report.problems.join(" ")).toMatch(/expected column not found/);
    expect(noEmployment.occupations).toEqual([]);
  });

  it("reports duplicate keys and codes that do not fit their level", () => {
    const head = ["Occupation Level", "NFD Indicator", "ANZSCO Code", "Occupation", "Skill level", "Baseline May 2025 ('000)", "Projected May 2030 ('000)", "Projected May 2035 ('000)", "5-Year Change Level ('000)", "5-Year Change %", "10-Year Change Level ('000)", "10-Year Change %"];
    const row = (code: string, level = 4) => [level, "N", code, "T", "1", 1, 1, 1, 0, 0, 0, 0];
    const r = parseProjectionRows([head, row("1111"), row("1111"), row("11")]);
    expect(r.report.problems.join(" ")).toMatch(/duplicate/);
    expect(r.report.problems.join(" ")).toMatch(/does not fit level/);
  });
});
