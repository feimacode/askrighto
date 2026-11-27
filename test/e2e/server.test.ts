import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const PKG_VERSION: string = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
).version;
const BUNDLE = resolve(import.meta.dirname, "../../dist/askrighto.js");
const PORT = String(4100 + Math.floor(Math.random() * 500));
const URL_BASE = `http://127.0.0.1:${PORT}`;

let proc: ChildProcess;
let logs = "";

/** The environment for a spawned server, without anything from the developer's own shell (a DATABASE_URL would switch the energy module on and change what these tests see). */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !/^(DATABASE_|ASKRIGHTO_|TEST_DATABASE_URL)/.test(k))
      env[k] = v;
  }
  return env;
}

async function start(env: Record<string, string>): Promise<ChildProcess> {
  const p = spawn(process.execPath, [BUNDLE, "--http"], {
    env: { ...cleanEnv(), PORT, HOST: "127.0.0.1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  p.stderr!.on("data", (d) => (logs += String(d)));
  await new Promise<void>((ok, bad) => {
    p.stdout!.on("data", (d) => String(d).includes("listening") && ok());
    p.on("exit", (c) =>
      bad(new Error(`server exited early with ${c}: ${logs}`)),
    );
  });
  return p;
}

beforeAll(async () => {
  proc = await start({
    ASKRIGHTO_RATE_LIMIT: "200",
    ASKRIGHTO_BODY_LIMIT: "2kb",
  });
});
afterAll(() => {
  proc.kill();
});

describe("HTTP server", () => {
  it("answers /healthz with ok and the version, without any header", async () => {
    const res = await fetch(`${URL_BASE}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, version: PKG_VERSION });
  });

  it("answers /readyz with 200 when no checks are registered", async () => {
    const res = await fetch(`${URL_BASE}/readyz`);
    expect(res.status).toBe(200);
  });

  it("lists tools with annotations and calls list_data_sources over HTTP with no credentials", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${URL_BASE}/mcp`)),
    );
    expect(client.getInstructions()).toMatch(/Never estimate/);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("list_data_sources");
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.annotations?.destructiveHint).toBe(false);
      expect(typeof t.annotations?.openWorldHint).toBe("boolean");
      expect(t.annotations?.title).toBeTruthy();
    }
    const res = await client.callTool({
      name: "list_data_sources",
      arguments: {},
    });
    expect(res.structuredContent).toMatchObject({
      found: false,
      reason: "no_data_loaded",
    });
    await client.close();
  });

  it("logs the tool name but never arguments", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${URL_BASE}/mcp`)),
    );
    await client.callTool({
      name: "list_data_sources",
      arguments: { sentinel: "SENTINEL-VALUE-123" },
    });
    await client.close();
    await new Promise((r) => setTimeout(r, 200));
    expect(logs).toContain('"tool":"list_data_sources"');
    expect(logs).not.toContain("SENTINEL-VALUE-123");
  });

  it("rejects an oversized body with 413", async () => {
    const res = await fetch(`${URL_BASE}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { pad: "x".repeat(5000) },
      }),
    });
    expect(res.status).toBe(413);
  });
});

describe("rate limit and host allow-list", () => {
  it("answers 429 with Retry-After beyond the limit, and rejects other hosts", async () => {
    const p2Port = String(5100 + Math.floor(Math.random() * 500));
    const p = spawn(process.execPath, [BUNDLE, "--http"], {
      env: {
        ...cleanEnv(),
        PORT: p2Port,
        HOST: "127.0.0.1",
        ASKRIGHTO_RATE_LIMIT: "3",
        ASKRIGHTO_ALLOWED_HOSTS: "127.0.0.1",
        ASKRIGHTO_LOG: "off",
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
    try {
      await new Promise<void>((ok) =>
        p.stdout!.on("data", (d) => String(d).includes("listening") && ok()),
      );
      const call = () =>
        fetch(`http://127.0.0.1:${p2Port}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
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

      const bad = await fetch(`http://127.0.0.1:${p2Port}/mcp`, {
        method: "POST",
        headers: { host: "evil.example", "content-type": "application/json" },
        body: "{}",
      }).catch(() => undefined);
      if (bad) expect(bad.status).toBeGreaterThanOrEqual(400);
    } finally {
      p.kill();
    }
  });
});

describe("stdio", () => {
  it("serves the same tools over stdio", async () => {
    const client = new Client({ name: "e2e-stdio", version: "0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [BUNDLE],
        env: cleanEnv(),
      }),
    );
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("list_data_sources");
    const res = await client.callTool({
      name: "list_data_sources",
      arguments: {},
    });
    expect(res.structuredContent).toMatchObject({
      found: false,
      reason: "no_data_loaded",
    });
    await client.close();
  });
});

describe("internal route", () => {
  const TOKEN = "t".repeat(20) + "A".repeat(23);
  let p3: ChildProcess;
  let base = "";
  let log3 = "";

  beforeAll(async () => {
    const port = String(5700 + Math.floor(Math.random() * 300));
    base = `http://127.0.0.1:${port}`;
    p3 = spawn(process.execPath, [BUNDLE, "--http"], {
      env: {
        ...cleanEnv(),
        PORT: port,
        HOST: "127.0.0.1",
        ASKRIGHTO_INTERNAL_TOKEN: TOKEN,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    p3.stderr!.on("data", (d) => (log3 += String(d)));
    await new Promise<void>((ok) =>
      p3.stdout!.on("data", (d) => String(d).includes("listening") && ok()),
    );
  });
  afterAll(() => p3.kill());

  const post = (path: string) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });

  it("answers 404 for the plain path and a wrong token, with no-index", async () => {
    for (const path of [
      "/mcp-internal",
      "/mcp-internal/",
      `/mcp-internal/${"x".repeat(43)}`,
      "/readyz-internal/nope",
      "/metrics-internal/nope",
    ]) {
      const r = await post(path);
      expect(r.status, path).toBe(404);
      expect(r.headers.get("x-robots-tag")).toBe("noindex");
    }
  });

  it("serves tools on the right token and never logs the token", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`${base}/mcp-internal/${TOKEN}`),
      ),
    );
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("list_data_sources");
    await client.close();
    const ready = await fetch(`${base}/readyz-internal/${TOKEN}`);
    expect([200, 503]).toContain(ready.status);
    const metrics = await (
      await fetch(`${base}/metrics-internal/${TOKEN}`)
    ).text();
    expect(metrics).toContain("askrighto_tool_outcomes_total");
    await new Promise((r) => setTimeout(r, 200));
    expect(log3).toContain("/mcp-internal/***");
    expect(log3).not.toContain(TOKEN);
  });

  it("does not exist when no token is set", async () => {
    expect(
      (
        await fetch(`${URL_BASE}/mcp-internal/${TOKEN}`, {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" },
        })
      ).status,
    ).toBe(404);
  });
});

describe("courses loaded but internal-only", () => {
  const TOKEN = "k".repeat(20) + "B".repeat(23);
  let p4: ChildProcess;
  let base = "";
  beforeAll(async () => {
    const port = String(6100 + Math.floor(Math.random() * 300));
    base = `http://127.0.0.1:${port}`;
    p4 = spawn(process.execPath, [BUNDLE, "--http"], {
      env: {
        ...cleanEnv(),
        PORT: port,
        HOST: "127.0.0.1",
        ASKRIGHTO_VERTICALS: "energy,courses-domestic",
        ASKRIGHTO_PUBLIC_VERTICALS: "energy",
        ASKRIGHTO_INTERNAL_TOKEN: TOKEN,
        ASKRIGHTO_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((ok, bad) => {
      p4.stdout!.on("data", (d) => String(d).includes("listening") && ok());
      p4.on("exit", (c) => bad(new Error(`exited ${c}`)));
    });
  });
  afterAll(() => p4.kill());

  it("shows no course tool, instruction or dataset on /mcp, and rejects a course tool by name", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`)),
    );
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names.some((n) => /course|vce|early_entry/.test(n))).toBe(false);
    expect(client.getInstructions()).not.toMatch(
      /index_only|search_domestic_courses/,
    );
    const res = await client
      .callTool({ name: "search_domestic_courses", arguments: {} })
      .catch((e) => e);
    expect(
      res instanceof Error || (res as { isError?: boolean }).isError === true,
    ).toBe(true);
    await client.close();
  });

  it("lists the course tools and instructions on the internal route", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`${base}/mcp-internal/${TOKEN}`),
      ),
    );
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "search_domestic_courses",
        "get_domestic_course",
        "get_vce_admissions_sources",
      ]),
    );
    expect(names).not.toContain("compare_domestic_courses");
    expect(client.getInstructions()).toMatch(/CRICOS course index/);
    const res = await client.callTool({
      name: "search_domestic_courses",
      arguments: {},
    });
    expect(
      (res.structuredContent as { found?: boolean; reason?: string }).reason,
    ).toBe("data_unavailable");
    await client.close();
  });
});

describe("ChatGPT domain check route", () => {
  const TOKEN = "challenge-" + "x".repeat(30);
  let p4: ChildProcess;
  let base = "";
  let log4 = "";

  beforeAll(async () => {
    const port = String(6100 + Math.floor(Math.random() * 300));
    base = `http://127.0.0.1:${port}`;
    p4 = spawn(process.execPath, [BUNDLE, "--http"], {
      env: {
        ...cleanEnv(),
        PORT: port,
        HOST: "127.0.0.1",
        ASKRIGHTO_OPENAI_CHALLENGE: TOKEN,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    p4.stderr!.on("data", (d) => (log4 += String(d)));
    await new Promise<void>((ok) =>
      p4.stdout!.on("data", (d) => String(d).includes("listening") && ok()),
    );
  });
  afterAll(() => p4.kill());

  it("serves the token as plain text and keeps it out of the log", async () => {
    const res = await fetch(`${base}/.well-known/openai-apps-challenge`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toBe(TOKEN);
    // The access line is written when the response finishes: give it a moment.
    for (let i = 0; i < 20 && !log4.includes("openai-apps-challenge"); i++)
      await new Promise((r) => setTimeout(r, 50));
    expect(log4).toContain("/.well-known/openai-apps-challenge");
    expect(log4).not.toContain(TOKEN);
  });

  it("is a 404 on a server with no token set", async () => {
    const res = await fetch(`${URL_BASE}/.well-known/openai-apps-challenge`);
    expect(res.status).toBe(404);
  });
});
