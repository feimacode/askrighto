import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { Catalogue } from "../../src/courses/catalogue.js";
import { setCoursesRuntime } from "../../src/courses/index.js";
import { mergeIndex } from "../../src/courses/load.js";
import { parseProviderFile } from "../../src/courses/validate.js";
import { createServer } from "../../src/server/create-server.js";
import { routeSet } from "../../src/verticals.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { loadStudies } from "../../src/courses/studies.js";
import { readTables, readVceFiles } from "../../src/vce/load.js";
import type { VceData } from "../../src/vce/types.js";

export const FIXTURE_YAML = `
provider: { id: testu, name: Test University, coursesUrl: https://www.testu.edu.au/courses, searchUrl: https://www.testu.edu.au/search, domains: [testu.edu.au] }
courses:
  - id: testu-science
    name: Bachelor of Science
    level: bachelor
    fields: [science]
    campuses: [parkville]
    durationYears: 3
    summary: A three-year science degree with majors across the physical and life sciences.
    officialUrl: https://www.testu.edu.au/courses/science
    entryFigures:
      - { kind: lowest_selection_rank, value: 80.05, intakeYear: 2026, campus: parkville, sourceUrl: https://www.testu.edu.au/courses/science, checkedOn: "2026-11-01" }
      - { kind: guaranteed_atar, value: 85, intakeYear: 2027, campus: parkville, sourceUrl: https://www.testu.edu.au/courses/science, checkedOn: "2026-11-01" }
    prerequisites:
      appliesToYear: 2028
      text: English at least 25 (EAL at least 30), one of Methods or Specialist at least 25, and Chemistry at least 25.
      rules:
        - { study: english-group, minScore: 25, ealMinScore: 30 }
        - { anyOf: [{ study: mathematical-methods, minScore: 25 }, { study: specialist-mathematics, minScore: 25 }] }
        - { study: chemistry, minScore: 25 }
      sourceUrl: https://www.testu.edu.au/courses/science
      checkedOn: "2026-11-01"
    otherCriteria: [{ kind: folio, note: Portfolio of work }]
  - id: testu-arts
    name: Bachelor of Arts
    level: bachelor
    fields: [arts]
    campuses: [parkville]
    summary: A broad arts degree.
    officialUrl: https://www.testu.edu.au/courses/arts
    entryFigures:
      - { kind: lowest_selection_rank, value: 71, intakeYear: 2025, sourceUrl: https://www.testu.edu.au/courses/arts, checkedOn: "2026-11-02" }
    prerequisites:
      appliesToYear: 2027
      text: English at least 25.
      rules: [{ study: english-group, minScore: 25 }]
      sourceUrl: https://www.testu.edu.au/courses/arts
      checkedOn: "2026-11-02"
  - id: testu-nursing
    origin: gap_fill
    name: Bachelor of Nursing
    fields: [nursing]
    foundAt: https://www.testu.edu.au/courses
    officialUrl: https://www.testu.edu.au/courses/nursing
    courseSeekerUrl: https://www.courseseeker.edu.au/course/testu-nursing
`;

export function fixtureCatalogue(): Catalogue {
  const r = parseProviderFile(FIXTURE_YAML);
  if (r.errors.length || !r.file) throw new Error(r.errors.join("; "));
  const m = mergeIndex([r.file]);
  return {
    providers: m.providers,
    courses: m.courses,
    loadedAt: new Date("2026-11-10T00:00:00Z"),
  };
}

/** Real dates, rules and schemes; synthetic scaling and groupings (the real tables are not in the repo). */
export function fixtureVce(): VceData {
  const f = readVceFiles(`${process.cwd()}/data`);
  const errors: string[] = [];
  const t = readTables(
    `${process.cwd()}/test/fixtures/vce-data`,
    ["."],
    loadStudies(),
    errors,
  );
  if (errors.length) throw new Error(errors.join("; "));
  return {
    ...f.data,
    scaling: t.scaling,
    groupings: t.groupings,
    loadedAt: new Date("2026-11-10T00:00:00Z"),
  };
}

export function installFixtureRuntime(vce: VceData = fixtureVce()) {
  const cat = fixtureCatalogue();
  setCoursesRuntime({
    courses: { catalogue: async () => cat },
    vce: { data: async () => vce },
    stop: async () => {},
  });
}

export async function connectCourses(route = "internal") {
  const set = routeSet(ALL_VERTICALS, ["energy", "courses-domestic"]);
  const server = createServer(set.tools, {
    route,
    instructions: set.instructions,
  });
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

export async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const res = await client.callTool({ name, arguments: args });
  return {
    res,
    data: ((res.structuredContent as { grounded?: unknown }).grounded ??
      res.structuredContent) as {
      found: boolean;
      reason?: string;
      message?: string;
      data?: any;
      warnings?: string[];
      source?: any;
      asOf?: string;
    },
    text: (res.content as { text: string }[])[0]!.text,
  };
}

export const COURSES_DATASET_IDS = [
  "vic-courses",
  "nsw-act-courses",
  "qld-courses",
  "vce-key-dates",
  "vtac-preference-rules",
  "vic-early-entry",
  "vce-scaling",
  "vce-study-groupings",
  "cricos-register",
];
