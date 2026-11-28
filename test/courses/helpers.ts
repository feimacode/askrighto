import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { Catalogue } from "../../src/courses/catalogue.js";
import { setCoursesRuntime } from "../../src/courses/index.js";
import { mergeIndex } from "../../src/courses/load.js";
import { parseCricos } from "../../src/courses/cricos.js";
import { parseProviderFile } from "../../src/courses/validate.js";
import { createServer } from "../../src/server/create-server.js";
import { routeSet } from "../../src/verticals.js";
import { ALL_VERTICALS } from "../../src/server/route.js";

export const FIXTURE_YAML = `
provider: { id: testu, cricosProviderCode: "00001A", name: Test University, coursesUrl: https://www.testu.edu.au/courses, searchUrl: https://www.testu.edu.au/search, domains: [testu.edu.au] }
`;

export const CRICOS_CSV = `CRICOS Provider Code,CRICOS Course Code,Course Name,Course Level,Duration (Weeks),Locations
00001A,111111A,"Bachelor of Law, Testing",Bachelor Degree,208,Parkville;Clayton
00001A,333333C,Bachelor of Science,Bachelor Degree,156,Parkville
00001A,222222B,Graduate Certificate of X,Graduate Certificate,26,Parkville
`;

export function fixtureCatalogue(): Catalogue {
  const r = parseProviderFile(FIXTURE_YAML);
  if (r.errors.length || !r.file) throw new Error(r.errors.join("; "));
  const m = mergeIndex([r.file], parseCricos(CRICOS_CSV).courses);
  return {
    providers: m.providers.map((p) => ({ ...p, region: "vic" as const })),
    courses: m.courses,
    loadedAt: new Date("2026-11-10T00:00:00Z"),
  };
}

export function installFixtureRuntime(cat: Catalogue = fixtureCatalogue()) {
  setCoursesRuntime({
    courses: { catalogue: async () => cat },
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

export const COURSES_DATASET_IDS = ["cricos-register", "admissions-links"];
