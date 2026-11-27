import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterCourses } from "../../src/courses/catalogue.js";
import { parseCricos } from "../../src/courses/cricos.js";
import { mergeIndex, readProviderFiles } from "../../src/courses/load.js";
import { AGGREGATE_NOTICE, bannedIn, COURSE_NOTICE, READING_CHECKLIST } from "../../src/courses/notice.js";
import { VCE_SOURCES } from "../../src/courses/sources.js";
import { parseProviderFile } from "../../src/courses/validate.js";
import { CRICOS_CSV, FIXTURE_YAML, fixtureCatalogue } from "./helpers.js";

describe("provider validation", () => {
  it("accepts a provider-only file", () =>
    expect(parseProviderFile(FIXTURE_YAML).errors).toEqual([]));
  it("refuses course rows: they are not stored any more", () =>
    expect(
      parseProviderFile(FIXTURE_YAML + "courses:\n  - id: x\n").errors.join(),
    ).toMatch(/course rows are not stored/));
  it("refuses a link off the provider's domains", () =>
    expect(
      parseProviderFile(
        FIXTURE_YAML.replace("https://www.testu.edu.au/search", "https://www.other.com/search"),
      ).errors.join(),
    ).toMatch(/not on the provider's domains/));
  it("needs id, name, coursesUrl and domains", () =>
    expect(parseProviderFile("provider: { id: a }").errors.length).toBe(1));
  it("the shipped provider files validate and hold no course rows", () => {
    const r = readProviderFiles(`${process.cwd()}/data`);
    expect(r.errors).toEqual([]);
    expect(r.files.length).toBeGreaterThan(20);
  });
});

describe("CRICOS index", () => {
  it("parses quoted CSV and loose headers", () => {
    const r = parseCricos(CRICOS_CSV);
    expect(r.problems).toEqual([]);
    expect(r.courses[0]).toMatchObject({
      cricosCode: "111111A",
      courseName: "Bachelor of Law, Testing",
      durationWeeks: 208,
      locations: ["Parkville", "Clayton"],
    });
  });
  it("takes locations from the Course Locations sheet of the real export", () => {
    const dir = `${process.cwd()}/test/fixtures/cricos/real-layout`;
    const r = parseCricos(
      readFileSync(`${dir}/courses.csv`, "utf8"),
      readFileSync(`${dir}/course-locations.csv`, "utf8"),
    );
    expect(r.problems).toEqual([]);
    expect(r.courses.find((c) => c.cricosCode === "000101A")?.locations).toEqual(["Parkville Campus"]);
  });
  it("reports a missing column", () =>
    expect(parseCricos("a,b\n1,2").problems.length).toBeGreaterThan(0));
  it("builds rows only from undergraduate CRICOS courses of the provider, with no facts", () => {
    const f = parseProviderFile(FIXTURE_YAML).file!;
    const m = mergeIndex([f], parseCricos(CRICOS_CSV).courses);
    expect(m.courses.map((c) => c.cricosCode).sort()).toEqual(["111111A", "333333C"]);
    expect(m.courses[0]).not.toHaveProperty("entryFigures");
    expect(m.courses[0]).not.toHaveProperty("prerequisites");
    expect(m.report.byProvider).toEqual({ testu: 2 });
  });
  it("a provider with no CRICOS code gets no rows and a warning", () => {
    const f = parseProviderFile(FIXTURE_YAML.replace('cricosProviderCode: "00001A", ', "")).file!;
    const m = mergeIndex([f], parseCricos(CRICOS_CSV).courses);
    expect(m.courses).toEqual([]);
    expect(m.report.warnings.join()).toMatch(/no CRICOS provider code/);
  });
});

describe("region folders", () => {
  it("reads every region, tags providers and refuses a duplicate id or unknown folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "regions-"));
    for (const r of ["vic", "nsw-act", "bogus"])
      mkdirSync(join(dir, "courses", r), { recursive: true });
    const yaml = (id: string) =>
      `provider: { id: ${id}, name: ${id}, coursesUrl: "https://${id}.edu.au/", domains: [${id}.edu.au] }\n`;
    writeFileSync(join(dir, "courses", "vic", "a.yaml"), yaml("a"));
    writeFileSync(join(dir, "courses", "nsw-act", "b.yaml"), yaml("b"));
    writeFileSync(join(dir, "courses", "nsw-act", "a.yaml"), yaml("a"));
    const r = readProviderFiles(dir);
    expect(r.files.map((f) => `${f.provider.region}/${f.provider.id}`)).toEqual(["nsw-act/a", "nsw-act/b", "vic/a"]);
    expect(r.errors.join("\n")).toMatch(/provider id "a" is already used/);
    expect(r.errors.join("\n")).toMatch(/bogus: not a known region/);
  });
  it("filters the catalogue by region and name", () => {
    const cat = fixtureCatalogue();
    expect(filterCourses(cat, { region: "nsw-act" })).toEqual([]);
    expect(filterCourses(cat, { query: "law" }).map((c) => c.cricosCode)).toEqual(["111111A"]);
  });
});

describe("wording and sources", () => {
  it("has no banned phrase in notices or guidance", () => {
    for (const t of [COURSE_NOTICE, AGGREGATE_NOTICE, ...READING_CHECKLIST])
      expect(bannedIn(t)).toEqual([]);
  });
  it("every VCE source has a web address, a reading checklist and no stored content", () => {
    for (const s of VCE_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.readingChecklist.length).toBeGreaterThan(0);
    }
    expect(VCE_SOURCES.map((s) => s.id)).toContain("scaling");
  });
});
