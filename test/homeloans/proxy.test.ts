import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { RetailerLimiter } from "../../src/cdr/limiter.js";
import {
  CdrProxy,
  parseBrands,
  resolveLender,
  safeBaseUri,
  setCdrProxy,
} from "../../src/homeloans/proxy.js";
import { createServer } from "../../src/server/create-server.js";
import { routeSet } from "../../src/verticals.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { call } from "../courses/helpers.js";

const REGISTER = {
  data: [
    {
      dataHolderBrandId: "b1",
      brandName: "Alpha Bank",
      publicBaseUri: "https://api.alpha.example.com/",
      industries: ["banking"],
    },
    {
      dataHolderBrandId: "b2",
      brandName: "Alpha Credit Union",
      publicBaseUri: "https://api.alphacu.example.com",
      industries: ["banking"],
    },
    {
      dataHolderBrandId: "b3",
      brandName: "Beta Bank",
      publicBaseUri: "https://api.beta.example.com",
      industries: ["banking"],
    },
    {
      dataHolderBrandId: "b4",
      brandName: "Evil",
      publicBaseUri: "https://127.0.0.1",
      industries: ["banking"],
    },
    {
      dataHolderBrandId: "b5",
      brandName: "Power Co",
      publicBaseUri: "https://api.power.example.com",
      industries: ["energy"],
    },
  ],
};

interface Seen {
  url: string;
  v: string | null;
}
function mock(opts: { alphaOnly?: number[]; status?: number } = {}) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    seen.push({ url, v: h.get("x-v") });
    expect(init?.redirect).toBe("error");
    if (url.includes("cdr-register"))
      return new Response(JSON.stringify(REGISTER), { status: 200 });
    if (opts.status) return new Response("{}", { status: opts.status });
    const v = Number(h.get("x-v"));
    if (opts.alphaOnly && !opts.alphaOnly.includes(v))
      return new Response("{}", { status: 406 });
    return new Response(
      JSON.stringify({
        data: { products: [{ productId: "p1", name: "Home" }] },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  return {
    seen,
    proxy: new CdrProxy({
      fetchImpl,
      limiter: new RetailerLimiter({ rps: 1000, maxInFlight: 8 }),
    }),
  };
}

afterEach(() => setCdrProxy(undefined));

describe("proxy safety and parsing", () => {
  it("accepts only public https dotted hosts", () => {
    expect(safeBaseUri("https://api.x.example.com/")).toBe(
      "https://api.x.example.com",
    );
    for (const bad of [
      "http://a.example.com",
      "https://127.0.0.1",
      "https://localhost",
      "https://u:p@a.example.com",
      "https://a.example.com:8443",
      "https://a.internal",
      "https://[::1]",
      "https://a.example.com/?x=1",
      5,
    ])
      expect(safeBaseUri(bad)).toBeUndefined();
  });
  it("keeps banking brands with safe URIs only", () => {
    expect(parseBrands(REGISTER).map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });
  it("resolves by id, exact name, or a single partial match, and reports ambiguity", () => {
    const b = parseBrands(REGISTER);
    expect(resolveLender(b, "b3")).toMatchObject({ ok: true });
    expect(resolveLender(b, "alpha bank")).toMatchObject({ ok: true });
    expect(resolveLender(b, "beta")).toMatchObject({ ok: true });
    const amb = resolveLender(b, "alpha");
    expect(amb.ok).toBe(false);
  });
});

describe("proxy requests", () => {
  it("falls back through versions on 406 and reports the one used", async () => {
    const { proxy, seen } = mock({ alphaOnly: [3] });
    const brand = parseBrands(REGISTER)[0]!;
    const r = await proxy.list(brand, 1, 100);
    expect(r.xVersion).toBe(3);
    expect(
      seen.filter((s) => s.url.includes("/products?")).map((s) => s.v),
    ).toEqual(["5", "4", "3"]);
    expect(seen.at(-1)!.url).toContain("page-size=25");
  });
  it("does not retry on other errors, and fails when no version works", async () => {
    const brand = parseBrands(REGISTER)[0]!;
    await expect(
      mock({ status: 500 }).proxy.list(brand, 1, 10),
    ).rejects.toMatchObject({ kind: "bad_response" });
    await expect(
      mock({ status: 406 }).proxy.detail(brand, "p1"),
    ).rejects.toMatchObject({ kind: "version_unsupported" });
  });
  it("rejects a product id that could change the path", () => {
    const brand = parseBrands(REGISTER)[0]!;
    expect(() => mock().proxy.detail(brand, "../../x")).toThrow();
  });
  it("caches only the brand list", async () => {
    const { proxy, seen } = mock();
    await proxy.brands();
    await proxy.brands();
    expect(seen.filter((s) => s.url.includes("cdr-register"))).toHaveLength(1);
  });
});

describe("proxy failure shapes and storage", () => {
  const brand = parseBrands(REGISTER)[0]!;
  const with200 = (body: string, redirect = false) =>
    new CdrProxy({
      limiter: new RetailerLimiter({ rps: 1000, maxInFlight: 8 }),
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        if (redirect && init?.redirect === "error") throw new TypeError("redirect refused");
        return new Response(body, { status: 200 });
      }) as unknown as typeof fetch,
    });
  it("treats a 200 without CDR data as a bad response", async () => {
    await expect(with200("{}").list(brand, 1, 5)).rejects.toMatchObject({ kind: "bad_response" });
    await expect(with200("not json").list(brand, 1, 5)).rejects.toMatchObject({ kind: "bad_response" });
  });
  it("refuses an oversized body", async () => {
    await expect(with200("x".repeat(2_000_001)).list(brand, 1, 5)).rejects.toMatchObject({ kind: "too_large" });
  });
  it("reports a refused redirect as the lender being unreachable", async () => {
    await expect(with200("{}", true).list(brand, 1, 5)).rejects.toMatchObject({ kind: "lender_unreachable" });
  });
  it("makes a lender call every time: product data is not cached", async () => {
    const { proxy, seen } = mock();
    await proxy.list(brand, 1, 5);
    await proxy.list(brand, 1, 5);
    await proxy.detail(brand, "p1");
    await proxy.detail(brand, "p1");
    expect(seen.filter((x) => x.url.includes("/cds-au/"))).toHaveLength(4);
  });
  it("writes a lender response nowhere: the module has no file, database or log access, and prints nothing", async () => {
    const marker = "UNIQUE-LENDER-MARKER-7731";
    const logs: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation((...a) => void logs.push(a.join(" "))));
    const src = readFileSync("src/homeloans/proxy.ts", "utf8");
    expect(src).not.toMatch(/node:fs|from "pg"|\.\.\/db|console\./);
    const proxy = new CdrProxy({
      limiter: new RetailerLimiter({ rps: 1000, maxInFlight: 8 }),
      fetchImpl: (async () => new Response(JSON.stringify({ data: { products: [{ productId: marker }] } }), { status: 200 })) as unknown as typeof fetch,
    });
    await proxy.list(brand, 1, 5);
    await proxy.detail(brand, "p1");
    expect(logs.join("\n")).not.toContain(marker);
    spies.forEach((x) => x.mockRestore());
  });
});

describe("proxy tools", () => {
  async function connect() {
    const set = routeSet(ALL_VERTICALS, ["home-loans"]);
    const server = createServer(set.tools, {
      route: "internal",
      instructions: set.instructions,
    });
    const client = new Client({ name: "t", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
  }
  it("lists lenders, relays product data unchanged with fetch time, and asks when a name is ambiguous", async () => {
    setCdrProxy(mock().proxy);
    const c = await connect();
    const l = await call(c, "list_home_loan_lenders", { name: "beta" });
    expect(l.data.data.lenders).toHaveLength(1);
    const p = await call(c, "get_home_loan_products", { lender: "Beta Bank" });
    expect(p.data.found).toBe(true);
    expect(p.data.data.lenderResponse.data.products[0].productId).toBe("p1");
    expect(p.data.data.fetchedAt).toMatch(/^\d{4}-/);
    const amb = await call(c, "get_home_loan_products", { lender: "alpha" });
    expect(amb.data.found).toBe(false);
    expect(amb.text).toMatch(/more than one lender/);
  });
  it("says data is unavailable, not guessed, when the lender fails", async () => {
    setCdrProxy(mock({ status: 503 }).proxy);
    const r = await call(await connect(), "get_home_loan_products", {
      lender: "Beta Bank",
    });
    expect(r.data.found).toBe(false);
    expect(r.text).toMatch(/home loan page/);
  });
});

describe("mock lender mode", () => {
  it("serves invented lenders through the real proxy, including the version fallback and a failing lender", async () => {
    const { mockCdrFetch, mockCdrEnabled } = await import("../../src/homeloans/mock-cdr.js");
    const proxy = new CdrProxy({ fetchImpl: mockCdrFetch, limiter: new RetailerLimiter({ rps: 1000, maxInFlight: 8 }) });
    const brands = await proxy.brands();
    expect(brands.map((b) => b.id)).toContain("mock-westpac");
    const westpac = resolveLender(brands, "westpac");
    if (!westpac.ok) throw new Error("westpac not resolved");
    const list = await proxy.list(westpac.brand, 1, 5);
    expect(list.xVersion).toBe(4); // refuses 5, accepts 4
    const detail = await proxy.detail(westpac.brand, "mock-westpac-var");
    expect((detail.body as { data: { lendingRates: { rate: string }[] } }).data.lendingRates[0]!.rate).toBe("0.0599");
    expect(resolveLender(brands, "beyond").ok).toBe(false); // two Beyond Bank brands
    const down = resolveLender(brands, "unavailable");
    if (!down.ok) throw new Error("unavailable lender not resolved");
    await expect(proxy.list(down.brand, 1, 5)).rejects.toMatchObject({ kind: "bad_response", status: 503 });
    expect(mockCdrEnabled({ ASKRIGHTO_CDR_MOCK: "1", NODE_ENV: "test" })).toBe(true);
    expect(mockCdrEnabled({ ASKRIGHTO_CDR_MOCK: "1", NODE_ENV: "production" })).toBe(false);
    expect(mockCdrEnabled({})).toBe(false);
  });
  it("the tools use the mock when ASKRIGHTO_CDR_MOCK=1, with no network", async () => {
    vi.stubEnv("ASKRIGHTO_CDR_MOCK", "1");
    vi.stubEnv("NODE_ENV", "test");
    setCdrProxy(undefined);
    const set = routeSet(ALL_VERTICALS, ["home-loans"]);
    const server = createServer(set.tools, { route: "internal", instructions: set.instructions });
    const client = new Client({ name: "t", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      const r = await call(client, "get_home_loan_products", { lender: "Westpac" });
      expect(r.data.found).toBe(true);
      expect(r.data.data.xVersionUsed).toBe(4);
      const down = await call(client, "get_home_loan_products", { lender: "Unavailable Credit Union" });
      expect(down.data.found).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      setCdrProxy(undefined);
    }
  });
});
