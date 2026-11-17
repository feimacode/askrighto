import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCoursesRuntime } from "../../src/courses/index.js";
import { bannedIn, COURSE_NOTICE } from "../../src/courses/notice.js";
import { resetMetrics, metricsText } from "../../src/core/metrics.js";
import { call, connectCourses, installFixtureRuntime } from "./helpers.js";

beforeEach(() => installFixtureRuntime());
afterEach(() => {
  setCoursesRuntime(undefined);
  vi.unstubAllEnvs();
});

describe("search_domestic_courses", () => {
  it("lists tools with annotations and flat schemas", async () => {
    const c = await connectCourses();
    const { tools } = await c.listTools();
    const names = tools.map((t) => t.name);
    for (const n of [
      "search_domestic_courses",
      "get_domestic_course",
      "compare_domestic_courses",
      "check_domestic_course_prerequisites",
      "get_subject_scaling",
      "estimate_vce_aggregate",
      "get_vce_key_dates",
      "list_early_entry_schemes",
    ])
      expect(names).toContain(n);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.openWorldHint).toBe(false);
    }
  });
  it("searches by field and university, with depth, figure kind and official link", async () => {
    const c = await connectCourses();
    const { data, text } = await call(c, "search_domestic_courses", {
      field: "science",
      university: "Test",
    });
    expect(data.found).toBe(true);
    expect(data.data.courses).toHaveLength(1);
    expect(data.data.courses[0]).toMatchObject({
      courseId: "testu-science",
      depth: "curated",
      officialUrl: "https://www.testu.edu.au/courses/science",
    });
    expect(data.data.courses[0].latestFigure.label).toMatch(
      /Lowest selection rank that received an offer in 2026/,
    );
    expect(text).toContain(COURSE_NOTICE);
    expect(data.data.notice).toBe(COURSE_NOTICE);
  });
  it("filters by studies ignoring scores, and says so; index-only courses are kept but unchecked", async () => {
    const c = await connectCourses();
    const { data } = await call(c, "search_domestic_courses", {
      vceStudies: ["English", "Biology", "Psychology", "General Maths"],
      limit: 50,
    });
    const ids = data.data.courses.map((x: { courseId: string }) => x.courseId);
    expect(ids).not.toContain("testu-science");
    expect(ids).toContain("testu-arts");
    expect(ids).toContain("testu-nursing");
    expect(data.data.notes.join(" ")).toMatch(/scores were not considered/);
    expect(
      data.data.courses.find(
        (x: { courseId: string }) => x.courseId === "testu-nursing",
      ).prerequisitesCheck,
    ).toBe("cannot_check");
  });
  it("filters by figure", async () => {
    const c = await connectCourses();
    const { data } = await call(c, "search_domestic_courses", { figureAtMost: 75 });
    expect(
      data.data.courses.map((x: { courseId: string }) => x.courseId),
    ).toEqual(["testu-arts"]);
    expect(data.data.notes.join(" ")).toMatch(/lowest selection rank/);
  });
  it("needs_input with candidates for an unknown study", async () => {
    const { data } = await call(await connectCourses(), "search_domestic_courses", {
      vceStudies: ["Maths"],
    });
    expect(data).toMatchObject({ found: false, reason: "needs_input" });
    expect(data.message).toMatch(/Mathematical Methods/);
  });
  it("pages results", async () => {
    const { data } = await call(await connectCourses(), "search_domestic_courses", {
      limit: 1,
    });
    expect(data.data.nextCursor).toBe("1");
    const p2 = await call(await connectCourses(), "search_domestic_courses", {
      limit: 1,
      cursor: "1",
    });
    expect(p2.data.data.courses[0].courseId).not.toBe(
      data.data.courses[0].courseId,
    );
  });
});

describe("get_domestic_course", () => {
  it("shows several figure kinds with their own labels and the prerequisites with a year warning", async () => {
    const { data, text } = await call(await connectCourses(), "get_domestic_course", {
      courseId: "testu-science",
      entryYear: 2029,
    });
    expect(data.data.depth).toBe("curated");
    expect(
      data.data.entryFigures.map((f: { label: string }) => f.label),
    ).toEqual([
      "Guaranteed entry ATAR for 2027 entry",
      "Lowest selection rank that received an offer in 2026 (after adjustments)",
    ]);
    expect(data.data.prerequisites.appliesToYear).toBe(2028);
    expect(data.warnings?.join(" ")).toMatch(/2029 entry are not held yet/);
    expect(text).not.toMatch(/the ATAR you need/);
    expect(data.source.url).toBe("https://www.testu.edu.au/courses/science");
    expect(data.asOf).toBe("2026-11-01T00:00:00Z");
  });
  it("returns links and a checklist, no facts, for an index-only course", async () => {
    const { data, text } = await call(await connectCourses(), "get_domestic_course", {
      courseId: "testu-nursing",
    });
    expect(data.data.depth).toBe("index_only");
    expect(data.data.entryFigures).toBeUndefined();
    expect(data.data.prerequisites).toBeUndefined();
    expect(data.data.officialUrl).toBeTruthy();
    expect(data.data.courseSeekerUrl).toMatch(/courseseeker/);
    expect(data.data.readingChecklist.length).toBeGreaterThanOrEqual(3);
    expect(data.data.message).toMatch(/no checked facts/);
    expect(text).toMatch(/read by the assistant/);
  });
  it("not_in_dataset for an unknown course", async () => {
    const { data } = await call(await connectCourses(), "get_domestic_course", {
      courseId: "nope",
    });
    expect(data).toMatchObject({ found: false, reason: "not_in_dataset" });
  });
  it("sends the course Inkview component alongside the grounded envelope", async () => {
    const { res } = await call(await connectCourses(), "get_domestic_course", {
      courseId: "testu-science",
    });
    expect(
      (res.structuredContent as { grounded?: unknown }).grounded,
    ).toBeTruthy();
  });
});

describe("compare_domestic_courses", () => {
  it("compares curated and index-only side by side, warns on different years", async () => {
    const { data, text } = await call(
      await connectCourses(),
      "compare_domestic_courses",
      { courseIds: ["testu-science", "testu-arts", "testu-nursing"] },
    );
    expect(data.found).toBe(true);
    expect(data.data.notes.join()).toMatch(/different intake years/);
    expect(text).toMatch(/cannot_check/);
    expect(text).toContain(COURSE_NOTICE);
  });
  it("needs 2 to 5", async () => {
    const six = Array(6).fill("testu-arts");
    const { data } = await call(await connectCourses(), "compare_domestic_courses", {
      courseIds: six,
    });
    expect(data).toMatchObject({ found: false, reason: "needs_input" });
    expect(data.message).toMatch(/at most five/);
  });
});

describe("check_domestic_course_prerequisites", () => {
  const ids = ["testu-science", "testu-arts", "testu-nursing"];
  it("names missing maths alternatives, and cannot_check for index-only", async () => {
    const { data } = await call(
      await connectCourses(),
      "check_domestic_course_prerequisites",
      { courseIds: ids, vceStudies: ["English", "Chemistry"], entryYear: 2028 },
    );
    const by = Object.fromEntries(
      data.data.courses.map((c: { courseId: string }) => [c.courseId, c]),
    );
    expect(by["testu-science"].result).toBe("not_met");
    expect(by["testu-science"].missing.join()).toMatch(
      /Mathematical Methods.*Specialist/,
    );
    expect(by["testu-arts"].result).toBe("needs_scores");
    expect(by["testu-nursing"].result).toBe("cannot_check");
    expect(by["testu-nursing"].readingChecklist.length).toBeGreaterThan(0);
    expect(data.data.outcome).toBe("cannot_check");
  });
  it("lists other criteria without evaluating them", async () => {
    const { data } = await call(
      await connectCourses(),
      "check_domestic_course_prerequisites",
      {
        courseIds: ["testu-science"],
        vceStudies: ["English", "Methods", "Chemistry"],
        studyScores: [30, 30, 30],
        entryYear: 2028,
      },
    );
    expect(data.data.courses[0].result).toBe("met");
    expect(data.data.courses[0].otherCriteria.join()).toMatch(/folio/);
  });
  it("EAL minimum", async () => {
    const { data } = await call(
      await connectCourses(),
      "check_domestic_course_prerequisites",
      {
        courseIds: ["testu-science"],
        vceStudies: ["EAL", "Methods", "Chemistry"],
        studyScores: [28, 30, 30],
        eal: true,
        entryYear: 2028,
      },
    );
    expect(data.data.courses[0].result).toBe("not_met");
    expect(data.data.courses[0].missing.join()).toMatch(/at least 30/);
  });
  it("mismatched lists", async () => {
    const { data } = await call(
      await connectCourses(),
      "check_domestic_course_prerequisites",
      {
        courseIds: ids,
        vceStudies: ["English", "Chemistry"],
        studyScores: [30],
      },
    );
    expect(data).toMatchObject({ found: false, reason: "needs_input" });
    expect(data.message).toMatch(/order of the studies/);
  });
  it("neither logs nor counts the studies or scores", async () => {
    resetMetrics();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await call(await connectCourses(), "check_domestic_course_prerequisites", {
      courseIds: ids,
      vceStudies: ["English", "Chemistry"],
      studyScores: [37, 41],
    });
    const out =
      JSON.stringify([...spy.mock.calls, ...log.mock.calls]) + metricsText();
    spy.mockRestore();
    log.mockRestore();
    expect(out).not.toMatch(/Chemistry|37|41|testu-/);
  });
});

describe("planning tools", () => {
  it("returns dates with provisional flag and source", async () => {
    const { data, text } = await call(
      await connectCourses(),
      "get_vce_key_dates",
      { admissionsYear: 2027, kind: "vcaa" },
    );
    expect(data.data.dates.length).toBeGreaterThan(0);
    expect(
      data.data.dates.every(
        (d: { issuingBody: string; sourceUrl: string }) =>
          d.issuingBody === "VCAA" && d.sourceUrl,
      ),
    ).toBe(true);
    expect(text).toMatch(/provisional/);
  });
  it("unknown year is not_in_dataset", async () => {
    expect(
      (
        await call(await connectCourses(), "get_vce_key_dates", {
          admissionsYear: 2031,
        })
      ).data.reason,
    ).toBe("not_in_dataset");
  });
  it("lists schemes without any eligibility field", async () => {
    const { data } = await call(
      await connectCourses(),
      "list_early_entry_schemes",
      { university: "RMIT" },
    );
    expect(data.data.schemes).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/eligib(le|ility)"/);
    expect(data.data.notice).toMatch(/Whether a student qualifies/);
  });
  it("aggregate and scaling in development, with a warning and not-an-ATAR text", async () => {
    const c = await connectCourses();
    const agg = await call(c, "estimate_vce_aggregate", {
      vceStudies: [
        "English",
        "Chemistry",
        "Methods",
        "Physics",
        "Biology",
        "Psychology",
      ],
      studyScores: [35, 36, 30, 32, 31, 28],
    });
    expect(agg.data.found).toBe(true);
    expect(agg.data.data.aggregate).toBeGreaterThan(100);
    expect(agg.data.data.notAnAtar).toMatch(/not an ATAR/);
    expect(agg.data.warnings?.join()).toMatch(/development only/);
    const sc = await call(c, "get_subject_scaling", { study: "Methods" });
    expect(sc.data.data.points.length).toBeGreaterThan(3);
  });
  it("aggregate needs 4 to 6 studies", async () => {
    expect(
      (
        await call(await connectCourses(), "estimate_vce_aggregate", {
          vceStudies: ["English"],
          studyScores: [30],
        })
      ).data.reason,
    ).toBe("needs_input");
  });
  it("scaling and aggregate are data_unavailable in production while permission is pending", async () => {
    vi.stubEnv("ASKRIGHTO_ENV", "production");
    const c = await connectCourses();
    const sc = await call(c, "get_subject_scaling", { study: "Methods" });
    expect(sc.data).toMatchObject({ found: false, reason: "data_unavailable" });
    expect(JSON.stringify(sc.data)).not.toMatch(/scaledScore/);
    const agg = await call(c, "estimate_vce_aggregate", {
      vceStudies: ["English", "Chemistry", "Methods", "Physics"],
      studyScores: [35, 36, 30, 32],
    });
    expect(agg.data.reason).toBe("data_unavailable");
    // courses themselves are served in production
    expect(
      (await call(c, "get_domestic_course", { courseId: "testu-arts" })).data.found,
    ).toBe(true);
  });
});

describe("every course result", () => {
  it("carries the notice and no banned phrase", async () => {
    const c = await connectCourses();
    const calls: Array<[string, Record<string, unknown>]> = [
      ["search_domestic_courses", {}],
      ["get_domestic_course", { courseId: "testu-science" }],
      ["get_domestic_course", { courseId: "testu-nursing" }],
      ["compare_domestic_courses", { courseIds: ["testu-science", "testu-arts"] }],
      [
        "check_domestic_course_prerequisites",
        {
          courseIds: ["testu-science", "testu-nursing"],
          vceStudies: ["English"],
        },
      ],
    ];
    for (const [n, a] of calls) {
      const { data, text } = await call(c, n, a);
      expect(data.found, n).toBe(true);
      expect(text, n).toContain(COURSE_NOTICE);
      expect(data.data.notice, n).toBe(COURSE_NOTICE);
      expect(bannedIn(text), `${n}: ${bannedIn(text)}`).toEqual([]);
    }
  });
  it("is unavailable, not an error, when no runtime is installed", async () => {
    setCoursesRuntime(undefined);
    const { data } = await call(await connectCourses(), "search_domestic_courses", {});
    expect(data).toMatchObject({ found: false, reason: "data_unavailable" });
  });
  it("instructions carry the course section only on a route that serves courses", async () => {
    const c = await connectCourses();
    expect(c.getInstructions()).toMatch(/index_only/);
  });
});
