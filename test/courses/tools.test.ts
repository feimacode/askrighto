import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setCoursesRuntime } from "../../src/courses/index.js";
import { bannedIn, COURSE_NOTICE } from "../../src/courses/notice.js";
import { call, connectCourses, installFixtureRuntime } from "./helpers.js";

beforeEach(() => installFixtureRuntime());
afterEach(() => setCoursesRuntime(undefined));

const REMOVED = [
  "compare_domestic_courses",
  "check_domestic_course_prerequisites",
  "get_subject_scaling",
  "estimate_vce_aggregate",
  "get_vce_key_dates",
  "list_early_entry_schemes",
];

describe("course tools (index-only)", () => {
  it("serves the three tools, read-only, and none of the removed ones", async () => {
    const c = await connectCourses();
    const { tools } = await c.listTools();
    const names = tools.map((t) => t.name);
    for (const n of ["search_domestic_courses", "get_domestic_course", "get_vce_admissions_sources"])
      expect(names).toContain(n);
    for (const n of REMOVED) expect(names).not.toContain(n);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.openWorldHint).toBe(false);
    }
  });

  it("searches the CRICOS index: code, campus, duration, provider link, and no facts", async () => {
    const c = await connectCourses();
    const { data, text } = await call(c, "search_domestic_courses", { query: "law" });
    expect(data.found).toBe(true);
    expect(data.data.courses).toHaveLength(1);
    expect(data.data.courses[0]).toMatchObject({
      cricosCode: "111111A",
      university: "Test University",
      campuses: ["Parkville", "Clayton"],
      durationYears: 4,
      courseSearchUrl: "https://www.testu.edu.au/search",
    });
    for (const k of ["entryFigures", "prerequisites", "latestFigure", "depth"])
      expect(data.data.courses[0]).not.toHaveProperty(k);
    expect(data.source).toMatchObject({ licence: "CC BY 2.5 AU" });
    expect(data.data.notice).toBe(COURSE_NOTICE);
    expect(text).toContain(COURSE_NOTICE);
  });

  it("a search with no match says CRICOS may miss domestic-only courses and gives the university's search link", async () => {
    const c = await connectCourses();
    const { data } = await call(c, "search_domestic_courses", { query: "underwater basket weaving", university: "Test" });
    expect(data.found).toBe(false);
    expect(data.reason).toBe("not_in_dataset");
    expect(data.message).toMatch(/international students/);
    expect(data.message).toContain("https://www.testu.edu.au/search");
  });

  it("gets one course with a reading checklist, browsing rules and user-only links", async () => {
    const c = await connectCourses();
    const { data } = await call(c, "get_domestic_course", { courseId: "testu-cricos-333333c" });
    expect(data.found).toBe(true);
    expect(data.data.message).toMatch(/holds no entry figures or prerequisites/);
    expect(data.data.readingChecklist.length).toBeGreaterThan(2);
    expect(data.data.browsingRules).toMatch(/never send|Never send/i);
    expect(data.data.userLinks.courseSeeker).toMatch(/courseseeker/);
  });

  it("an unknown course id is not_in_dataset", async () => {
    const c = await connectCourses();
    const { data } = await call(c, "get_domestic_course", { courseId: "nope" });
    expect(data).toMatchObject({ found: false, reason: "not_in_dataset" });
  });

  it("gives the scaling report link with a checklist, and no scaled scores", async () => {
    const c = await connectCourses();
    const { data, text } = await call(c, "get_vce_admissions_sources", { topic: "scaling" });
    expect(data.found).toBe(true);
    expect(data.data.sources).toHaveLength(1);
    expect(data.data.sources[0].url).toMatch(/^https:\/\/www\.vtac\.edu\.au\//);
    expect(data.data.sources[0].readingChecklist.length).toBeGreaterThan(0);
    expect(data.data.rules).toMatch(/not an ATAR/);
    expect(text).not.toMatch(/scaled score of \d/);
  });

  it("returns every admissions source by default and warns while links are unconfirmed", async () => {
    const c = await connectCourses();
    const { data } = await call(c, "get_vce_admissions_sources", {});
    expect(data.data.sources.length).toBeGreaterThanOrEqual(4);
    expect(data.warnings?.join()).toMatch(/not yet confirmed/);
  });

  it("reports data unavailable with no runtime", async () => {
    setCoursesRuntime(undefined);
    const c = await connectCourses();
    const { data } = await call(c, "search_domestic_courses", {});
    expect(data).toMatchObject({ found: false, reason: "data_unavailable" });
  });

  it("uses no banned phrase in any rendered result", async () => {
    const c = await connectCourses();
    for (const [n, a] of [
      ["search_domestic_courses", {}],
      ["get_domestic_course", { courseId: "testu-cricos-111111a" }],
      ["get_vce_admissions_sources", {}],
    ] as const) {
      const { text } = await call(c, n, a);
      expect(bannedIn(text.replace(/never say[^.]*\./gi, ""))).toEqual([]);
    }
  });
});
