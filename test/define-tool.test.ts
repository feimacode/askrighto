import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { defineTool, registerTools, validateToolDefinition } from "../src/core/define-tool.js";
import { found, notFound } from "../src/core/grounded.js";
import { clearDataSets, registerDataSet } from "../src/core/registry.js";
import { createServer } from "../src/server/create-server.js";

const source = { name: "Test", url: "https://example.org", licence: "CC BY 4.0" };

function good(overrides: Record<string, unknown> = {}) {
  return {
    name: "get_thing",
    title: "Get thing",
    description: "Gets a thing.",
    inputSchema: z.object({ id: z.string() }),
    readOnlyHint: true as const,
    destructiveHint: false as const,
    openWorldHint: false,
    handler: ({ id }: { id: string }) => (id === "1" ? found({ data: { id }, source, asOf: "2026-11-13T00:00:00Z" }) : notFound("not_in_dataset", "No such thing.")),
    render: (d: { id: string }) => `Thing ${d.id}`,
    ...overrides,
  };
}

describe("tool rules", () => {
  it("accepts a well-formed tool", () => {
    expect(() => validateToolDefinition(defineTool(good()))).not.toThrow();
  });

  it("rejects names that are not verb-first snake_case", () => {
    expect(() => validateToolDefinition(good({ name: "thing_getter" }))).toThrow(/verb/);
    expect(() => validateToolDefinition(good({ name: "getThing" }))).toThrow(/snake_case/);
    expect(() => validateToolDefinition(good({ name: "get" }))).toThrow(/snake_case/);
  });

  it("rejects missing or wrong annotations", () => {
    expect(() => validateToolDefinition(good({ readOnlyHint: undefined }))).toThrow(/readOnlyHint/);
    expect(() => validateToolDefinition(good({ destructiveHint: true }))).toThrow(/destructiveHint/);
    expect(() => validateToolDefinition(good({ openWorldHint: undefined }))).toThrow(/openWorldHint/);
  });

  it("rejects a missing title or description", () => {
    expect(() => validateToolDefinition(good({ title: "" }))).toThrow(/title/);
    expect(() => validateToolDefinition(good({ description: " " }))).toThrow(/description/);
  });

  it("rejects nested input schemas but allows enums and lists of plain values", () => {
    const nested = z.object({ profile: z.object({ kwh: z.number() }) });
    expect(() => validateToolDefinition(good({ inputSchema: nested }))).toThrow(/"profile"/);
    const flat = z.object({ postcode: z.string(), fuel: z.enum(["ELECTRICITY", "GAS"]).optional(), ids: z.array(z.string()).optional(), n: z.number().int().optional() });
    expect(() => validateToolDefinition(good({ inputSchema: flat }))).not.toThrow();
    const listOfObjects = z.object({ rows: z.array(z.object({ a: z.string() })) });
    expect(() => validateToolDefinition(good({ inputSchema: listOfObjects }))).toThrow(/"rows"/);
  });

  it("fails server start when a tool breaks a rule", () => {
    expect(() => createServer([good({ openWorldHint: undefined })])).toThrow(/openWorldHint/);
  });

  it("rejects a duplicate tool name", () => {
    const server = createServer([]);
    expect(() => registerTools(server, [good(), good()])).toThrow(/twice/);
  });
});

async function connect(tools: Parameters<typeof createServer>[0]) {
  const server = createServer(tools);
  const client = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe("tool results", () => {
  it("returns structured content and text with the source footer", async () => {
    const client = await connect([good()]);
    const res = await client.callTool({ name: "get_thing", arguments: { id: "1" } });
    expect(res.isError ?? false).toBe(false);
    expect(res.structuredContent).toMatchObject({ found: true, data: { id: "1" }, source, asOf: "2026-11-13T00:00:00Z" });
    const text = (res.content as { text: string }[])[0]!.text;
    expect(text).toContain("Thing 1");
    expect(text).toContain("Source: Test (https://example.org), licence: CC BY 4.0. As of 2026-11-13T00:00:00Z.");
  });

  it("returns an explicit not-found, not an error", async () => {
    const client = await connect([good()]);
    const res = await client.callTool({ name: "get_thing", arguments: { id: "2" } });
    expect(res.isError ?? false).toBe(false);
    expect(res.structuredContent).toMatchObject({ found: false, reason: "not_in_dataset" });
    expect((res.content as { text: string }[])[0]!.text).toBe("No such thing.");
  });

  it("lists every tool with a title and all three hints set", async () => {
    const client = await connect([good()]);
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(t.annotations?.title).toBeTruthy();
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.destructiveHint).toBe(false);
      expect(typeof t.annotations?.openWorldHint).toBe("boolean");
    }
  });

  it("adds a staleness warning from the datasets a tool reads", async () => {
    clearDataSets();
    registerDataSet({ id: "t", title: "Test data", publisher: "P", source, coverage: "x", maxAgeHours: 1, refreshedAt: () => new Date("2020-01-01T00:00:00Z") });
    const client = await connect([good({ datasets: ["t"] })]);
    const res = await client.callTool({ name: "get_thing", arguments: { id: "1" } });
    expect((res.structuredContent as { warnings?: string[] }).warnings?.[0]).toContain("Test data");
    expect((res.content as { text: string }[])[0]!.text).toContain("Warning:");
    clearDataSets();
  });

  it("turns a thrown error into a plain error result without leaking details", async () => {
    const client = await connect([good({ handler: () => { throw new Error("secret-detail"); } })]);
    const res = await client.callTool({ name: "get_thing", arguments: { id: "1" } });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res)).not.toContain("secret-detail");
  });
});
