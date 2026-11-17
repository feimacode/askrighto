import { readdirSync, readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { parseHealthFiles } from "../../src/health/parse.js";
import { setHealthRuntime } from "../../src/health/index.js";
import { loadRates } from "../../src/health/rules.js";
import type { HealthData } from "../../src/health/types.js";
import { createServer } from "../../src/server/create-server.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";

export const FIXTURE_DIR = `${process.cwd()}/test/fixtures/health`;
export const fixtureXml = () =>
  readdirSync(FIXTURE_DIR)
    .filter((n) => n.endsWith(".xml"))
    .map((name) => ({ name, xml: readFileSync(`${FIXTURE_DIR}/${name}`, "utf8") }));

export function fixtureHealth(): HealthData {
  const r = parseHealthFiles(fixtureXml());
  return {
    insurers: r.insurers,
    products: r.products,
    categoryTitles: r.categoryTitles,
    sourceDate: new Date("2026-11-03T00:00:00Z"),
    sourceFile: "privatehealth-01-nov-2026",
    loadedAt: new Date("2026-11-10T00:00:00Z"),
  };
}
export function installHealth(data: HealthData = fixtureHealth()) {
  setHealthRuntime({ health: { data: async () => data }, rates: loadRates(), stop: async () => {} });
}
export async function connectHealth(ids = ["energy", "health-cover"], route = "internal") {
  const set = routeSet(ALL_VERTICALS, ids);
  const server = createServer(set.tools, { route, instructions: set.instructions });
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
export { call } from "../courses/helpers.js";
