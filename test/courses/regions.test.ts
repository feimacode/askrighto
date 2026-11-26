import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Catalogue } from "../../src/courses/catalogue.js";
import { setCoursesRuntime } from "../../src/courses/index.js";
import type { Course } from "../../src/courses/types.js";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { rightsFor } from "../../src/core/rights.js";
import { createServer } from "../../src/server/create-server.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";
import {
  call,
  connectCourses,
  fixtureCatalogue,
  fixtureVce,
} from "./helpers.js";

const idx = (id: string, providerId: string, name: string): Course => ({
  id,
  providerId,
  origin: "cricos",
  depth: "index_only",
  name,
  level: "bachelor",
  fields: [],
  campuses: [],
  cricosCode: id.toUpperCase(),
  officialUrl: `https://www.${providerId}.edu.au/${id}`,
  entryFigures: [],
  prerequisites: [],
  otherCriteria: [],
});

function multiRegion(): Catalogue {
  const base = fixtureCatalogue();
  const prov = (id: string, region: "vic" | "nsw-act" | "qld") => ({
    id,
    name: id.toUpperCase(),
    coursesUrl: `https://www.${id}.edu.au/`,
    domains: [`${id}.edu.au`],
    region,
  });
  return {
    ...base,
    providers: [
      ...base.providers.map((p) => ({ ...p, region: "vic" as const })),
      prov("usyd", "nsw-act"),
      prov("uq", "qld"),
    ],
    courses: [
      ...base.courses,
      idx("a1", "usyd", "Bachelor of Arts"),
      idx("a2", "uq", "Bachelor of Arts"),
    ],
  };
}

beforeEach(() => {
  const cat = multiRegion();
  setCoursesRuntime({
    courses: { catalogue: async () => cat },
    vce: { data: async () => fixtureVce() },
    stop: async () => {},
  });
});
afterEach(() => setCoursesRuntime(undefined));

describe("regions", () => {
  it("filters search by region", async () => {
    const c = await connectCourses();
    for (const [region, id] of [
      ["nsw-act", "a1"],
      ["qld", "a2"],
    ] as const) {
      const { data } = await call(c, "search_domestic_courses", { region });
      expect(
        data.data.courses.map((x: { courseId: string }) => x.courseId),
      ).toEqual([id]);
    }
    const all = await call(c, "search_domestic_courses", {
      query: "Bachelor of Arts",
    });
    expect(all.data.data.courses.length).toBeGreaterThanOrEqual(2);
  });

  it("says HSC and QCE subject rules are not built, and does not evaluate VCE studies", async () => {
    const { data, text } = await call(
      await connectCourses(),
      "check_domestic_course_prerequisites",
      { courseIds: ["a1", "a2"], vceStudies: ["English", "Methods"] },
    );
    for (const c of data.data.courses) expect(c.result).toBe("cannot_check");
    expect(JSON.stringify(data.warnings)).toMatch(/HSC or QCE subject rules/);
    expect(text).toMatch(/HSC or QCE/);
  });

  it("keeps the course and international tools off a public route that names only energy (P1)", async () => {
    const client = await (async () => {
      const set = routeSet(ALL_VERTICALS, ["energy"]);
      const server = createServer(set.tools, {
        route: "public",
        instructions: set.instructions,
      });
      const c = new Client({ name: "t", version: "0" });
      const [x, y] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(x), c.connect(y)]);
      return c;
    })();
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names.some((n) => /domestic|international/.test(n))).toBe(false);
  });

  it("registers the regional datasets and blocks the admissions centres", () => {
    for (const id of ["vic-courses", "nsw-act-courses", "qld-courses"])
      expect(rightsFor(id)?.status).toBe("cleared_pending_legal_view");
    for (const id of ["vtac-coursesearch", "uac-coursesearch", "qtac-coursesearch"])
      expect(rightsFor(id)?.status).toBe("pending");
  });
});
