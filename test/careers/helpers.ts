import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { parseProjectionsFile } from "../../src/careers/parse.js";
import { setCareerRuntime } from "../../src/careers/index.js";
import type { CareerData } from "../../src/careers/types.js";
import { createServer } from "../../src/server/create-server.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";

export const FIXTURE = `${process.cwd()}/test/fixtures/careers/employment_projections_synthetic.xlsx`;

export async function fixtureCareers(): Promise<CareerData> {
  const r = await parseProjectionsFile(FIXTURE);
  return {
    occupations: r.occupations,
    baselineLabel: r.baselineLabel,
    midLabel: r.midLabel,
    endLabel: r.endLabel,
    classification: r.classification,
    sourceDate: new Date("2025-11-06T00:00:00Z"),
    sourceFile: "synthetic",
    loadedAt: new Date("2026-11-18T00:00:00Z"),
  };
}
export async function installCareers(data?: CareerData) {
  const d = data ?? (await fixtureCareers());
  setCareerRuntime({ careers: { data: async () => d }, stop: async () => {} });
}
export async function connectCareers(ids = ["energy", "career-outcomes"], route = "internal") {
  const set = routeSet(ALL_VERTICALS, ids);
  const server = createServer(set.tools, { route, instructions: set.instructions });
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
export { call } from "../courses/helpers.js";
