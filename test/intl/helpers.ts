import { readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { setIntlRuntime } from "../../src/intl/index.js";
import { parseIntlCricos } from "../../src/intl/parse.js";
import type { IntlData } from "../../src/intl/types.js";
import { createServer } from "../../src/server/create-server.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";

export const FIXTURE = `${process.cwd()}/test/fixtures/cricos/intl-sample.csv`;

export function fixtureIntl(): IntlData {
  const r = parseIntlCricos(readFileSync(FIXTURE, "utf8"));
  if (r.problems.length) throw new Error(r.problems.join("; "));
  return {
    providers: r.providers,
    courses: r.courses,
    sourceDate: new Date("2026-02-02T00:00:00Z"),
    sourceFile: "intl-sample.csv",
    loadedAt: new Date("2026-11-10T00:00:00Z"),
  };
}
export function installIntl(data: IntlData = fixtureIntl()) {
  setIntlRuntime({ intl: { data: async () => data }, stop: async () => {} });
}
export async function connectIntl(
  ids = ["energy", "courses-domestic", "cricos"],
  route = "internal",
) {
  const set = routeSet(ALL_VERTICALS, ids);
  const server = createServer(set.tools, {
    route,
    instructions: set.instructions,
  });
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
export { call } from "../courses/helpers.js";
