// Live check of the CDR proxy against the real Register and three lenders. Skipped unless CDR_LIVE=1, so `npm test`
// never touches a lender. Run it with `npm run homeloans:live-check` (add-home-loan-proxy-evals). About seven requests
// in all: the Register once, then one list and one detail per lender, paced by the proxy's own per-host limiter.
import { describe, expect, it } from "vitest";
import { CdrProxy, resolveLender, type LenderBrand } from "../../src/homeloans/proxy.js";

const LENDERS = (process.env.CDR_LIVE_LENDERS ?? "CommBank,Westpac,NATIONAL AUSTRALIA BANK").split(",").map((s) => s.trim());

describe.skipIf(process.env.CDR_LIVE !== "1")("live CDR proxy", () => {
  const proxy = new CdrProxy();
  let brands: LenderBrand[] = [];

  it("reads the Register and keeps most banking brands", async () => {
    brands = await proxy.brands();
    expect(brands.length).toBeGreaterThan(50);
    console.info(`register: ${brands.length} banking brands kept`);
  });

  for (const name of LENDERS) {
    it(`${name}: reads a product list and one product's detail`, async () => {
      const r = resolveLender(brands, name);
      expect(r.ok, `${name} must match exactly one Register brand`).toBe(true);
      if (!r.ok) return;
      const t0 = Date.now();
      const list = await proxy.list(r.brand, 1, 5);
      const products = (list.body as { data: { products: { productId: string }[] } }).data.products;
      expect(products.length).toBeGreaterThan(0);
      expect([3, 4, 5]).toContain(list.xVersion);
      const detail = await proxy.detail(r.brand, products[0]!.productId);
      expect([5, 6, 7]).toContain(detail.xVersion);
      const rates = (detail.body as { data: { lendingRates?: { lendingRateType?: string; rate?: string; comparisonRate?: string }[] } }).data
        .lendingRates;
      expect(Array.isArray(rates) && rates.length > 0, "detail has lendingRates").toBe(true);
      for (const x of rates!) {
        expect(typeof x.lendingRateType).toBe("string");
        expect(Number(x.rate)).toBeGreaterThan(0);
        expect(Number(x.rate)).toBeLessThan(1); // a fraction, as the guide says
      }
      const withCmp = rates!.filter((x) => x.comparisonRate != null).length;
      console.info(
        `${r.brand.name}: list x-v ${list.xVersion}, ${products.length} products, detail x-v ${detail.xVersion}, ` +
          `${rates!.length} rates (${withCmp} with a comparison rate), ${Date.now() - t0} ms`,
      );
    });
  }
});
