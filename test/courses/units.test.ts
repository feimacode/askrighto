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
  it("rejects UAC and QTAC sources while their rights are pending", () => {
    for (const host of ["uac.edu.au", "www.qtac.edu.au"])
      expect(
        bad(
          FIXTURE_YAML.replace(
            "sourceUrl: https://www.testu.edu.au/courses/arts",
            `sourceUrl: https://${host}/x`,
          ),
        ),
      ).toMatch(/is not allowed/);
  });
  it("accepts NESA and QCAA pages as government sources", () => {
    for (const host of ["www.nesa.nsw.edu.au", "www.qcaa.qld.edu.au"])
      expect(
        bad(
          FIXTURE_YAML.replace(
            "sourceUrl: https://www.testu.edu.au/courses/arts",
            `sourceUrl: https://${host}/x`,
          ),
        ),
      ).toBe("");
  });
  it("reads admissions codes and keeps the VTAC code", () => {
    const f = parseProviderFile(
      FIXTURE_YAML.replace(
        "    name: Bachelor of Science",
        "    vtacCode: '1234'\n    admissions:\n      - { centre: uac, code: '5678' }\n    name: Bachelor of Science",
      ),
    ).file;
    expect(f?.courses[0]?.admissions).toEqual([
      { centre: "uac", code: "5678" },
      { centre: "vtac", code: "1234" },
    ]);
  });
  it("rejects an unknown admissions centre", () =>
    expect(
      parseProviderFile(
        FIXTURE_YAML.replace(
          "    name: Bachelor of Science",
          "    admissions:\n      - { centre: satac, code: '1' }\n    name: Bachelor of Science",
        ),
      ).errors.join("\n"),
    ).toMatch(/admissions centre must be one of/));
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
  it("takes locations from the Course Locations sheet of the real export", async () => {
    const { readFileSync } = await import("node:fs");
    const dir = `${process.cwd()}/test/fixtures/cricos/real-layout`;
    const r = parseCricos(
      readFileSync(`${dir}/courses.csv`, "utf8"),
      readFileSync(`${dir}/course-locations.csv`, "utf8"),
    );
    expect(r.problems).toEqual([]);
    const first = r.courses.find((c) => c.cricosCode === "000101A");
    expect(first?.locations).toEqual(["Parkville Campus"]);
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

describe("stand-in match report", () => {
  it("proposes unique, ambiguous and loose matches and never links", async () => {
    const { matchStandins } = await import("../../src/courses/standins.js");
    const mk = (id: string, name: string) => ({
      id,
      providerId: "p",
      origin: "gap_fill" as const,
      depth: "index_only" as const,
      name,
      level: "bachelor",
      fields: [],
      campuses: [],
      entryFigures: [],
      prerequisites: [],
      otherCriteria: [],
    });
    const cr = (code: string, name: string) => ({
      cricosCode: code,
      providerCode: "P1",
      courseName: name,
      locations: [],
    });
    const m = matchStandins(
      [
        {
          provider: {
            id: "p",
            name: "P",
            coursesUrl: "https://p.edu.au/",
            domains: ["p.edu.au"],
            cricosProviderCode: "P1",
          },
          courses: [
            mk("a", "Bachelor of Arts"),
            mk("b", "Bachelor of Science"),
            mk("c", "Bachelor of Nursing (First Year Entry Only)"),
            mk("d", "Bachelor of Law"),
          ],
        },
      ],
      [
        cr("1", "Bachelor of Arts"),
        cr("2", "Bachelor of Science"),
        cr("3", "Bachelor of Science"),
        cr("4", "Bachelor of Nursing"),
      ] as never,
    );
    expect(m.map((x) => x.status)).toEqual([
      "unique",
      "ambiguous",
      "loose",
      "none",
    ]);
    expect(m[1]!.candidates.map((x) => x.cricosCode)).toEqual(["2", "3"]);
  });
});

describe("region folders", () => {
  it("reads every region, tags providers and refuses a duplicate id or unknown folder", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { readProviderFiles } = await import("../../src/courses/load.js");
    const dir = mkdtempSync(join(tmpdir(), "regions-"));
    for (const r of ["vic", "nsw-act", "bogus"])
      mkdirSync(join(dir, "courses", r), { recursive: true });
    const yaml = (id: string) =>
      `provider: { id: ${id}, name: ${id}, coursesUrl: "https://${id}.edu.au/", domains: [${id}.edu.au] }\ncourses: []\n`;
    writeFileSync(join(dir, "courses", "vic", "a.yaml"), yaml("a"));
    writeFileSync(join(dir, "courses", "nsw-act", "b.yaml"), yaml("b"));
    writeFileSync(join(dir, "courses", "nsw-act", "a.yaml"), yaml("a"));
    writeFileSync(join(dir, "vce-studies.yaml"), "studies: []\ngroups: []\n");
    const r = readProviderFiles(dir);
    expect(r.files.map((f) => `${f.provider.region}/${f.provider.id}`)).toEqual(
      ["nsw-act/a", "nsw-act/b", "vic/a"],
    );
    expect(r.errors.join("\n")).toMatch(/provider id "a" is already used/);
    expect(r.errors.join("\n")).toMatch(/bogus: not a known region/);
  });
  it("filters the catalogue by region", async () => {
    const { filterCourses } = await import("../../src/courses/catalogue.js");
    const base = {
      origin: "cricos" as const,
      depth: "index_only" as const,
      level: "bachelor",
      fields: [],
      campuses: [],
      entryFigures: [],
      prerequisites: [],
      otherCriteria: [],
    };
    const cat = {
      providers: [
        { id: "v", name: "V", coursesUrl: "x", domains: [], region: "vic" },
        { id: "n", name: "N", coursesUrl: "x", domains: [], region: "nsw-act" },
      ],
      courses: [
        { ...base, id: "1", providerId: "v", name: "Arts" },
        { ...base, id: "2", providerId: "n", name: "Arts" },
      ],
      loadedAt: new Date(),
    } as never;
    expect(filterCourses(cat, { region: "nsw-act" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterCourses(cat, {}).length).toBe(2);
  });
});
