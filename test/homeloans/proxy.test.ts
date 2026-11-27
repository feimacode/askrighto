import { afterEach, describe, expect, it } from "vitest";
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
