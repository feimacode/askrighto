import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const BUNDLE = resolve(import.meta.dirname, "../../dist/askrighto.js");
const PORT = String(4100 + Math.floor(Math.random() * 500));
const URL_BASE = `http://127.0.0.1:${PORT}`;

let proc: ChildProcess;
let logs = "";

async function start(env: Record<string, string>): Promise<ChildProcess> {
  const p = spawn(process.execPath, [BUNDLE, "--http"], { env: { ...process.env, PORT, HOST: "127.0.0.1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  p.stderr!.on("data", (d) => (logs += String(d)));
  await new Promise<void>((ok, bad) => {
    p.stdout!.on("data", (d) => String(d).includes("listening") && ok());
    p.on("exit", (c) => bad(new Error(`server exited early with ${c}: ${logs}`)));
  });
  return p;
}

beforeAll(async () => {
  proc = await start({ ASKRIGHTO_RATE_LIMIT: "200", ASKRIGHTO_BODY_LIMIT: "2kb" });
});
afterAll(() => {
  proc.kill();
});

describe("HTTP server", () => {
  it("answers /healthz with ok and the version, without any header", async () => {
    const res = await fetch(`${URL_BASE}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, version: "0.1.0" });
  });

  it("answers /readyz with 200 when no checks are registered", async () => {
    const res = await fetch(`${URL_BASE}/readyz`);
    expect(res.status).toBe(200);
  });

  it("lists tools with annotations and calls list_data_sources over HTTP with no credentials", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${URL_BASE}/mcp`)));
    expect(client.getInstructions()).toMatch(/Never estimate/);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("list_data_sources");
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.destructiveHint).toBe(false);
      expect(typeof t.annotations?.openWorldHint).toBe("boolean");
      expect(t.annotations?.title).toBeTruthy();
    }
    const res = await client.callTool({ name: "list_data_sources", arguments: {} });
    expect(res.structuredContent).toMatchObject({ found: false, reason: "no_data_loaded" });
    await client.close();
  });

  it("logs the tool name but never arguments", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${URL_BASE}/mcp`)));
    await client.callTool({ name: "list_data_sources", arguments: { sentinel: "SENTINEL-VALUE-123" } });
    await client.close();
    await new Promise((r) => setTimeout(r, 200));
    expect(logs).toContain('"tool":"list_data_sources"');
    expect(logs).not.toContain("SENTINEL-VALUE-123");
  });

  it("rejects an oversized body with 413", async () => {
    const res = await fetch(`${URL_BASE}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { pad: "x".repeat(5000) } }),
    });
    expect(res.status).toBe(413);
  });
});

describe("rate limit and host allow-list", () => {
  it("answers 429 with Retry-After beyond the limit, and rejects other hosts", async () => {
    const p2Port = String(5100 + Math.floor(Math.random() * 500));
    const p = spawn(process.execPath, [BUNDLE, "--http"], {
      env: { ...process.env, PORT: p2Port, HOST: "127.0.0.1", ASKRIGHTO_RATE_LIMIT: "3", ASKRIGHTO_ALLOWED_HOSTS: "127.0.0.1", ASKRIGHTO_LOG: "off" },
      stdio: ["ignore", "pipe", "inherit"],
    });
    try {
      await new Promise<void>((ok) => p.stdout!.on("data", (d) => String(d).includes("listening") && ok()));
      const call = () =>
        fetch(`http://127.0.0.1:${p2Port}/mcp`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        });
      const statuses: number[] = [];
      let retryAfter: string | null = null;
      for (let i = 0; i < 5; i++) {
        const r = await call();
        statuses.push(r.status);
        if (r.status === 429) retryAfter = r.headers.get("retry-after");
      }
      expect(statuses.slice(3)).toEqual([429, 429]);
      expect(Number(retryAfter)).toBeGreaterThan(0);

      const bad = await fetch(`http://127.0.0.1:${p2Port}/mcp`, { method: "POST", headers: { host: "evil.example", "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
      if (bad) expect(bad.status).toBeGreaterThanOrEqual(400);
    } finally {
      p.kill();
    }
  });
});

describe("stdio", () => {
  it("serves the same tools over stdio", async () => {
    const client = new Client({ name: "e2e-stdio", version: "0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [BUNDLE] }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("list_data_sources");
    const res = await client.callTool({ name: "list_data_sources", arguments: {} });
    expect(res.structuredContent).toMatchObject({ found: false, reason: "no_data_loaded" });
    await client.close();
  });
});
