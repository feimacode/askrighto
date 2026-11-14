import { afterEach, describe, expect, it } from "vitest";
import { CdrClient, CdrError } from "../../src/energy/cdr-client.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

let mock: MockCdr | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

const mk = (rps = 200) => new CdrClient({ baseUrl: mock!.url, limiter: new RetailerLimiter({ rps, maxInFlight: 8 }), backoffMs: 5 });
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ detail: { ...fixture("single-rate"), planId: `P${i}` } }));

describe("CdrClient", () => {
  it("pages through links.next and sends version headers", async () => {
    mock = await startMockCdr({ retailers: { agl: many(5) }, pageSize: 2 });
    const items = await mk().listPlans("agl", "CURRENT");
    expect(items).toHaveLength(5);
    expect(mock.log.map((l) => l.path.includes("page=3"))).toContain(true);
    expect(mock.log.every((l) => l.v === "1")).toBe(true);
  });

  it("uses version 3 for detail and returns undefined on 404", async () => {
    mock = await startMockCdr({ retailers: { agl: many(1) } });
    const c = mk();
    expect(((await c.getDetail("agl", "P0")) as { planId: string }).planId).toBe("P0");
    expect(mock.log[0]!.v).toBe("3");
    expect(await c.getDetail("agl", "NOPE")).toBeUndefined();
  });

  it("retries 429 honouring Retry-After and counts it", async () => {
    mock = await startMockCdr({
      retailers: { agl: many(1) },
      inject: ({ n }) => (n <= 2 ? { status: 429, headers: { "retry-after": "0" } } : undefined),
    });
    const c = mk();
    await c.listPlans("agl", "CURRENT");
    expect(c.statsFor("agl")).toMatchObject({ throttled: 2, retried: 2, failed: 0 });
  });

  it("retries 5xx then gives up with an error", async () => {
    mock = await startMockCdr({ retailers: { agl: many(1) }, inject: () => ({ status: 503 }) });
    const c = mk();
    await expect(c.listPlans("agl", "CURRENT")).rejects.toBeInstanceOf(CdrError);
    expect(c.statsFor("agl").requests).toBe(4); // 1 try + 3 retries
    expect(c.statsFor("agl").failed).toBe(1);
  });

  it("ignores a next link that points at another host", async () => {
    mock = await startMockCdr({ retailers: { agl: many(1) } });
    const c = new CdrClient({
      baseUrl: mock.url,
      limiter: new RetailerLimiter({ rps: 200, maxInFlight: 8 }),
      fetchImpl: async () => new Response(JSON.stringify({ data: { plans: [] }, links: { next: "http://evil.test/x" } }), { status: 200 }),
    });
    expect(await c.listPlans("agl", "CURRENT")).toEqual([]);
  });
});

describe("RetailerLimiter", () => {
  it("never exceeds the per-retailer rate in any one second", async () => {
    mock = await startMockCdr({ retailers: { agl: many(1) } });
    const rps = 5;
    const c = mk(rps);
    await Promise.all(Array.from({ length: 12 }, () => c.getDetail("agl", "P0")));
    const times = mock.log.map((l) => l.at).sort((a, b) => a - b);
    for (let i = 0; i + rps < times.length; i++) {
      // any rps+1 consecutive requests must span at least a second (small timer tolerance)
      expect(times[i + rps]! - times[i]!).toBeGreaterThanOrEqual(950);
    }
  }, 15_000);

  it("slows a throttled retailer without slowing the others", async () => {
    const limiter = new RetailerLimiter({ rps: 8, maxInFlight: 8 });
    limiter.slowDown("a");
    limiter.slowDown("a");
    expect(limiter.rateOf("a")).toBe(2);
    expect(limiter.rateOf("b")).toBe(8);
  });

  it("caps requests in flight overall", async () => {
    const limiter = new RetailerLimiter({ rps: 1000, maxInFlight: 2 });
    let now = 0, max = 0;
    await Promise.all(
      ["a", "b", "c", "d", "e"].map((s) =>
        limiter.run(s, async () => {
          max = Math.max(max, ++now);
          await new Promise((r) => setTimeout(r, 20));
          now--;
        }),
      ),
    );
    expect(max).toBeLessThanOrEqual(2);
  });
});
