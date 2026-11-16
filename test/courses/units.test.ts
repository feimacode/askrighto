import { describe, expect, it } from "vitest";
import { parseCricos } from "../../src/courses/cricos.js";
import { mergeIndex } from "../../src/courses/load.js";
import {
  bannedIn,
  COURSE_NOTICE,
  FIGURE_LABEL,
} from "../../src/courses/notice.js";
import {
  couldMeet,
  evaluatePrerequisites,
} from "../../src/courses/prerequisites.js";
import { matchStudy } from "../../src/courses/studies.js";
import { parseProviderFile } from "../../src/courses/validate.js";
import { computeAggregate, scaledAt } from "../../src/vce/aggregate.js";
import { readVceFiles } from "../../src/vce/load.js";
import { FIXTURE_YAML, fixtureVce } from "./helpers.js";

const id = (s: string) => {
  const m = matchStudy(s);
  if (!m.ok) throw new Error(`no match ${s}`);
  return m.study.id;
};
const sci = parseProviderFile(FIXTURE_YAML).file!.courses[0]!.prerequisites[0]!;

describe("study matching", () => {
  it.each([
    ["Mathematical Methods", "mathematical-methods"],
    ["Methods", "mathematical-methods"],
    ["Spesh", "specialist-mathematics"],
    ["lit", "literature"],
    ["EAL", "english-as-an-additional-language"],
    ["Chemistry", "chemistry"],
  ])("matches %s", (i, want) => {
    const m = matchStudy(i);
    expect(m.ok && m.study.id).toBe(want);
  });
  it("returns candidates, not a guess, for an ambiguous name", () => {
    const m = matchStudy("English");
    expect(m.ok).toBe(true); // exact name wins
    const m2 = matchStudy("Maths");
    expect(m2.ok).toBe(false);
    expect(!m2.ok && m2.candidates.length).toBeGreaterThan(1);
  });
  it("returns nothing for rubbish", () => {
    expect(matchStudy("zzzz")).toEqual({ ok: false, candidates: [] });
  });
});

describe("prerequisite evaluation", () => {
  const ev = (studies: Array<[string, number?]>, eal = false) =>
    evaluatePrerequisites(
      sci,
      studies.map(([s, score]) => ({
        studyId: id(s),
        ...(score !== undefined ? { score } : {}),
      })),
      eal,
    );
  it("met with scores", () =>
    expect(
      ev([
        ["English", 30],
        ["Methods", 28],
        ["Chemistry", 27],
      ]).status,
    ).toBe("met"));
  it("not met without a maths study, naming both alternatives", () => {
    const r = ev([
      ["English", 30],
      ["Chemistry", 30],
    ]);
    expect(r.status).toBe("not_met");
    expect(r.missing.join(" ")).toMatch(
      /Mathematical Methods.*Specialist Mathematics/,
    );
  });
  it("needs scores when none given", () => {
    const r = ev([["English"], ["Methods"], ["Chemistry"]]);
    expect(r.status).toBe("needs_scores");
    expect(r.scoresNeeded.join(" ")).toMatch(/Chemistry at least 25/);
  });
  it("applies the EAL threshold", () => {
    const r = ev([
      ["EAL", 28],
      ["Methods", 30],
      ["Chemistry", 30],
    ]);
    expect(r.status).toBe("not_met");
    expect(r.missing.join(" ")).toMatch(/at least 30/);
  });
  it("short score is not met", () =>
    expect(
      ev([
        ["English", 30],
        ["Methods", 20],
        ["Chemistry", 30],
      ]).status,
    ).toBe("not_met"));
  it("couldMeet ignores scores", () => {
    expect(
      couldMeet(sci, [
        { studyId: id("English") },
        { studyId: id("Spesh") },
        { studyId: id("Chemistry") },
      ]),
    ).toBe(true);
    expect(
      couldMeet(sci, [{ studyId: id("English") }, { studyId: id("Biology") }]),
    ).toBe(false);
  });
});

describe("validation", () => {
  const bad = (yaml: string) =>
    parseProviderFile(yaml.replace("__", "")).errors.join("\n");
  it("accepts the fixture", () =>
    expect(parseProviderFile(FIXTURE_YAML).errors).toEqual([]));
  it("rejects an unknown study", () =>
    expect(
      bad(FIXTURE_YAML.replace("study: chemistry", "study: alchemy")),
    ).toMatch(/unknown study "alchemy"/));
  it("rejects a figure out of range", () =>
    expect(bad(FIXTURE_YAML.replace("value: 80.05", "value: 120"))).toMatch(
      /outside 0 to 99.95/,
    ));
  it("rejects a source off the provider's domain", () =>
    expect(
      bad(
        FIXTURE_YAML.replace(
          "sourceUrl: https://www.testu.edu.au/courses/arts",
          "sourceUrl: https://example.com/x",
        ),
      ),
    ).toMatch(/not on the provider's domain/));
  it("rejects a VTAC source while its rights are pending", () =>
    expect(
      bad(
        FIXTURE_YAML.replace(
          "sourceUrl: https://www.testu.edu.au/courses/arts",
          "sourceUrl: https://www.vtac.edu.au/x",
        ),
      ),
    ).toMatch(/vtac.edu.au is not allowed/));
  it("rejects a long summary", () =>
    expect(
      bad(
        FIXTURE_YAML.replace(
          "A broad arts degree.",
          Array(70).fill("word").join(" "),
        ),
      ),
    ).toMatch(/limit is 60/));
  it("rejects a banned word in a summary", () =>
    expect(
      bad(
        FIXTURE_YAML.replace(
          "A broad arts degree.",
          "The best course around, recommended.",
        ),
      ),
    ).toMatch(/banned/));
  it("rejects a duplicate id", () =>
    expect(
      bad(FIXTURE_YAML.replace("id: testu-arts", "id: testu-science")),
    ).toMatch(/duplicate/));
  it("rejects a gap fill without foundAt", () =>
    expect(
      bad(
        FIXTURE_YAML.replace(
          "    foundAt: https://www.testu.edu.au/courses\n",
          "",
        ),
      ),
    ).toMatch(/foundAt/));
  it("rejects a Course Seeker link off courseseeker.edu.au", () =>
    expect(
      bad(
        FIXTURE_YAML.replace(
          "https://www.courseseeker.edu.au/course/testu-nursing",
          "https://example.com/c",
        ),
      ),
    ).toMatch(/courseseeker/));
  it("the shipped data validates", () => {
    expect(readVceFiles(`${process.cwd()}/data`).errors).toEqual([]);
  });
});

describe("CRICOS merge", () => {
  const csv = `CRICOS Provider Code,CRICOS Course Code,Course Name,Course Level,Duration (Weeks),Locations\n00001A,111111A,"Bachelor of Law, Testing",Bachelor Degree,208,Parkville;Clayton\n00001A,222222B,Graduate Certificate of X,Graduate Certificate,26,Parkville\n`;
  it("parses quoted CSV and loose headers", () => {
    const r = parseCricos(csv);
    expect(r.problems).toEqual([]);
    expect(r.courses[0]).toMatchObject({
      cricosCode: "111111A",
      courseName: "Bachelor of Law, Testing",
      durationWeeks: 208,
      locations: ["Parkville", "Clayton"],
    });
  });
  it("skips the two title rows of the real export", () => {
    const r = parseCricos(`Courses\nReport generated 01/10/2026\n${csv}`);
    expect(r.problems).toEqual([]);
    expect(r.courses).toHaveLength(2);
  });
  it("reports a missing column", () =>
    expect(parseCricos("a,b\n1,2").problems.length).toBeGreaterThan(0));
  it("adds undergraduate CRICOS courses as index-only rows and skips others", () => {
    const f = parseProviderFile(
      FIXTURE_YAML.replace(
        "{ id: testu,",
        '{ id: testu, cricosProviderCode: "00001A",',
      ),
    ).file!;
    const m = mergeIndex([f], parseCricos(csv).courses);
    const added = m.courses.find((c) => c.cricosCode === "111111A")!;
    expect(added).toMatchObject({
      depth: "index_only",
      origin: "cricos",
      fromCricos: true,
      name: "Bachelor of Law, Testing",
    });
    expect(m.courses.some((c) => c.cricosCode === "222222B")).toBe(false);
    expect(m.report.byOrigin).toMatchObject({
      cricos: expect.any(Number),
      gap_fill: 1,
    });
  });
  it("drops an index row whose CRICOS code left CRICOS, but keeps curated ones", () => {
    const y = FIXTURE_YAML.replace(
      "  - id: testu-arts",
      "  - id: testu-gone\n    name: Gone\n    cricosCode: 999999Z\n    officialUrl: https://www.testu.edu.au/gone\n  - id: testu-arts",
    ).replace(
      "    name: Bachelor of Science",
      "    name: Bachelor of Science\n    cricosCode: 111111A",
    );
    const m = mergeIndex(
      [parseProviderFile(y).file!],
      parseCricos(csv).courses,
    );
    expect(m.courses.some((c) => c.id === "testu-gone")).toBe(false);
    expect(m.courses.some((c) => c.id === "testu-science")).toBe(true);
    expect(m.report.warnings.join()).toMatch(/999999Z/);
  });
});

describe("notice wording", () => {
  it("has no banned phrase", () => {
    expect(bannedIn(COURSE_NOTICE)).toEqual([]);
    for (const k of Object.values(FIGURE_LABEL))
      expect(bannedIn(k(2026))).toEqual([]);
  });
  it("says the figure kind and year", () =>
    expect(FIGURE_LABEL.lowest_selection_rank(2026)).toBe(
      "Lowest selection rank that received an offer in 2026 (after adjustments)",
    ));
});

describe("scaling and aggregate", () => {
  const pts: Array<[number, number]> = [
    [20, 20],
    [30, 31],
    [40, 41],
    [50, 50],
  ];
  it("is exact at a point, linear between, undefined outside", () => {
    expect(scaledAt(pts, 30)).toEqual({ scaled: 31, interpolated: false });
    expect(scaledAt(pts, 35)).toEqual({ scaled: 36, interpolated: true });
    expect(scaledAt(pts, 19)).toBeUndefined();
    expect(scaledAt(pts, 51)).toBeUndefined();
  });
  const data = fixtureVce();
  const table = data.scaling[0]!;
  const groups = data.groupings[0]!;
  const run = (list: Array<[string, number]>) =>
    computeAggregate(
      list.map(([n, raw]) => ({ studyId: id(n), name: n, raw })),
      table,
      groups,
    );
  it("counts primary four plus two 10% increments", () => {
    const r = run([
      ["English", 40],
      ["Chemistry", 40],
      ["Methods", 40],
      ["Physics", 40],
      ["Biology", 30],
      ["Psychology", 30],
    ]);
    expect(r.computed).toBe(true);
    const roles = r.studies.map((s) => s.role);
    expect(roles.filter((x) => x === "primary")).toHaveLength(4);
    expect(roles.filter((x) => x === "increment")).toHaveLength(2);
    if (r.computed) expect(r.aggregate).toBeGreaterThan(160);
  });
  it("needs an English-group study", () => {
    const r = run([
      ["Chemistry", 40],
      ["Methods", 40],
      ["Physics", 40],
      ["Biology", 40],
    ]);
    expect(r.computed).toBe(false);
  });
  it("needs four studies", () =>
    expect(
      run([
        ["English", 40],
        ["Methods", 40],
        ["Physics", 40],
      ]).computed,
    ).toBe(false));
  it("says why a study does not count", () => {
    const r = run([
      ["English", 40],
      ["Chemistry", 40],
      ["Methods", 40],
      ["Physics", 40],
      ["Biology", 30],
      ["Psychology", 30],
    ]);
    expect(r.studies.every((s) => s.reason.length > 0)).toBe(true);
  });
});
