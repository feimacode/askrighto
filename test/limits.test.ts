import { describe, expect, it } from "vitest";
import { httpConfig } from "../src/config.js";
import { clientKey, describeRpc, logLine, RateLimiter } from "../src/server/limits.js";

describe("rate limiter", () => {
  it("allows up to the limit then reports seconds to wait", () => {
    let t = 0;
    const l = new RateLimiter(2, 60_000, () => t);
    expect(l.take("a")).toBe(0);
    expect(l.take("a")).toBe(0);
    expect(l.take("a")).toBe(60);
    expect(l.take("b")).toBe(0);
    t = 60_001;
    expect(l.take("a")).toBe(0);
  });

  it("is off when the limit is 0", () => {
    const l = new RateLimiter(0, 1000);
    for (let i = 0; i < 1000; i++) expect(l.take("a")).toBe(0);
  });
});

describe("client key and logging", () => {
  it("prefers the trusted proxy header", () => {
    expect(clientKey({ "cf-connecting-ip": "1.2.3.4, 5.6.7.8" }, "9.9.9.9", "cf-connecting-ip")).toBe("1.2.3.4");
    expect(clientKey({}, "9.9.9.9", "cf-connecting-ip")).toBe("9.9.9.9");
    expect(clientKey({}, undefined)).toBe("unknown");
  });

  it("describes only the JSON-RPC method and tool name", () => {
    const body = { jsonrpc: "2.0", method: "tools/call", params: { name: "search_energy_plans", arguments: { postcode: "SENTINEL" } } };
    const d = describeRpc(body);
    expect(d).toEqual({ rpc: "tools/call", tool: "search_energy_plans" });
    expect(JSON.stringify(d)).not.toContain("SENTINEL");
    expect(describeRpc({ method: "tools/call", params: { name: "bad name; drop" } }).tool).toBeUndefined();
    expect(describeRpc("nope")).toEqual({});
  });

  it("formats a log line with no content fields", () => {
    const line = JSON.parse(logLine({ method: "POST", path: "/mcp", status: 200, ms: 5, rpc: "tools/call", tool: "x" }));
    expect(Object.keys(line).sort()).toEqual(["method", "ms", "path", "rpc", "status", "t", "tool"]);
  });
});

describe("http config", () => {
  it("reads settings with defaults", () => {
    expect(httpConfig({})).toMatchObject({ bodyLimit: "256kb", rateLimit: 120, trustProxy: false, log: true });
    const c = httpConfig({ ASKRIGHTO_RATE_LIMIT: "5", ASKRIGHTO_TRUST_PROXY: "1", ASKRIGHTO_ALLOWED_HOSTS: "a.com, b.com", ASKRIGHTO_LOG: "off", ASKRIGHTO_CLIENT_IP_HEADER: "CF-Connecting-IP" });
    expect(c).toMatchObject({ rateLimit: 5, trustProxy: true, log: false, allowedHosts: ["a.com", "b.com"], clientIpHeader: "cf-connecting-ip" });
  });
});
