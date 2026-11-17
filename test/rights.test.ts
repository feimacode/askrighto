import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { defineTool } from "../src/core/define-tool.js";
import { found } from "../src/core/grounded.js";
import {
  assertRegistrable,
  attributionFor,
  availability,
  overdueReviews,
  parseRights,
  RIGHTS,
  rightsFor,
} from "../src/core/rights.js";
import { createServer } from "../src/server/create-server.js";
import {
  resetMetrics,
  metricsSnapshot,
  metricsText,
} from "../src/core/metrics.js";

const ev = [
  { url: "https://example.org/terms", readOn: "2026-11-15", note: "x" },
];
const entry = (o: Record<string, unknown> = {}) => ({
  datasetId: "d",
  owner: "Owner",
  basis: "open_licence",
  status: "cleared",
  evidence: ev,
  reviewBy: "2027-01-01",
  conditions: [],
  ...o,
});

afterEach(() => vi.unstubAllEnvs());

describe("rights register", () => {
  it("accepts the shipped register", () => {
    expect(RIGHTS.length).toBeGreaterThan(5);
    expect(rightsFor("energy-plans")?.status).toBe("cleared");
  });
  it.each([
    [{ basis: "scraped" }, /basis/],
    [{ status: "maybe" }, /status/],
    [{ evidence: [] }, /evidence/],
    [{ evidence: [{ url: "nope", readOn: "2026-11-15" }] }, /URL/],
    [{ reviewBy: "soon" }, /reviewBy/],
    [{ owner: "" }, /owner/],
  ])("rejects a malformed entry %#", (o, re) => {
    expect(() => parseRights([entry(o)])).toThrow(re);
  });
  it("rejects a duplicate dataset id", () => {
    expect(() => parseRights([entry(), entry()])).toThrow(/duplicate/);
  });
  it("holds the three VTAC-dependent datasets back until permission arrives", () => {
    for (const id of [
      "vce-scaling",
      "vce-study-groupings",
      "vtac-coursesearch",
      "course-seeker",
    ])
      expect(rightsFor(id)?.status).toBe("pending");
  });
  it("lists overdue reviews", () => {
    expect(overdueReviews(new Date("2100-01-01")).length).toBe(RIGHTS.length);
    expect(overdueReviews(new Date("2026-11-15"))).toEqual([]);
  });
  it("gives CRICOS attribution", () => {
    expect(attributionFor(["cricos-register", "energy-plans"])).toMatch(
      /CRICOS.*CC BY 2\.5 AU/,
    );
  });
});

describe("production gate", () => {
  it("serves cleared and legal-view-pending datasets, holds pending ones", () => {
    const prod = { ASKRIGHTO_ENV: "production" } as NodeJS.ProcessEnv;
    expect(availability("energy-plans", prod).servable).toBe(true);
    expect(availability("vic-courses", prod).servable).toBe(true);
    expect(availability("vce-scaling", prod).servable).toBe(false);
    expect(availability("not-registered", prod).servable).toBe(false);
  });
  it("serves pending data in development, with a warning", () => {
    const a = availability("vce-scaling", {} as NodeJS.ProcessEnv);
    expect(a).toMatchObject({ servable: true });
    expect((a as { warning?: string }).warning).toMatch(/development only/);
  });
  it("refuses to register an unregistered dataset in production", () => {
    expect(() =>
      assertRegistrable("mystery", {
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toThrow(/no entry/);
  });

  it("makes a tool on a pending dataset answer data_unavailable in production", async () => {
    vi.stubEnv("ASKRIGHTO_ENV", "production");
    let ran = false;
    const tool = defineTool({
      name: "get_scaled_thing",
      title: "t",
      description: "d",
      inputSchema: z.object({}),
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      datasets: ["vce-scaling"],
      handler: () => {
        ran = true;
        return found({
          data: { n: 1 },
          source: { name: "s", url: "https://example.org", licence: "l" },
          asOf: "2026-11-15T00:00:00Z",
        });
      },
      render: () => "x",
    });
    const server = createServer([tool]);
    const client = new Client({ name: "t", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const res = await client.callTool({
      name: "get_scaled_thing",
      arguments: {},
    });
    expect(res.structuredContent).toMatchObject({
      found: false,
      reason: "data_unavailable",
    });
    expect(ran).toBe(false);
  });
});

describe("outcome counters", () => {
  it("count outcomes without arguments", async () => {
    resetMetrics();
    const tool = defineTool({
      name: "get_ok_thing",
      title: "t",
      description: "d",
      inputSchema: z.object({ q: z.string() }),
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      handler: () =>
        found({
          data: { depth: "index_only" },
          source: { name: "s", url: "https://example.org", licence: "l" },
          asOf: "2026-11-15T00:00:00Z",
        }),
      render: () => "x",
    });
    const server = createServer([tool], { route: "internal" });
    const client = new Client({ name: "t", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    await client.callTool({
      name: "get_ok_thing",
      arguments: { q: "SENTINEL-COURSE-ID" },
    });
    expect(metricsSnapshot()).toEqual([
      {
        route: "internal",
        tool: "get_ok_thing",
        outcomes: { index_only: 1 },
        count: 1,
      },
    ]);
    expect(metricsText()).toContain('outcome="index_only"');
    expect(JSON.stringify(metricsSnapshot()) + metricsText()).not.toContain(
      "SENTINEL-COURSE-ID",
    );
  });
});

describe("list_data_sources and attribution on results", () => {
  it("shows a held-back dataset as held back in production, and a CRICOS result carries attribution", async () => {
    vi.stubEnv("ASKRIGHTO_ENV", "production");
    const { registerDataSet, clearDataSets } =
      await import("../src/core/registry.js");
    const { makeListDataSources } =
      await import("../src/tools/list-data-sources.js");
    clearDataSets();
    registerDataSet({
      id: "vce-scaling",
      title: "Scaling",
      publisher: "VTAC",
      source: { name: "s", url: "https://example.org", licence: "x" },
      coverage: "c",
      refreshedAt: () => undefined,
      maxAgeHours: 1,
    });
    const attr = defineTool({
      name: "get_cricos_thing",
      title: "t",
      description: "d",
      inputSchema: z.object({}),
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      datasets: ["cricos-register"],
      handler: () =>
        found({
          data: { n: 1 },
          source: { name: "s", url: "https://example.org", licence: "l" },
          asOf: "2026-11-15T00:00:00Z",
        }),
      render: () => "x",
    });
    const server = createServer([makeListDataSources(), attr]);
    const client = new Client({ name: "t", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const list = await client.callTool({
      name: "list_data_sources",
      arguments: {},
    });
    expect(JSON.stringify(list.structuredContent)).toContain(
      '"availability":"held_back"',
    );
    const res = await client.callTool({
      name: "get_cricos_thing",
      arguments: {},
    });
    expect(
      (res.structuredContent as { source: { attribution?: string } }).source
        .attribution,
    ).toMatch(/CC BY 2\.5 AU/);
    expect((res.content as { text: string }[])[0]!.text).toMatch(
      /CC BY 2\.5 AU/,
    );
    clearDataSets();
  });
});
