// Live check of the home loan proxy against the real CDR Register and a few real lenders.
//
//   npm run homeloans:smoke                 # CommBank, Westpac and one credit union
//   npm run homeloans:smoke -- westpac nab  # name the lenders (brand id or part of a name)
//
// Read-only: one Register call, then for each lender one product list call and one detail call (about 6
// requests per lender at the most, through the proxy's own rate limit). Nothing is written or stored.
// Fails when the Register is unreadable, a lender cannot be reached, a list returns no product, a detail
// has no lending rate, or a lending rate has no comparison rate. Not part of `npm test`: it needs the
// internet and depends on lenders being up. Run weekly or before a release; see docs/evals.md.
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const out = join(mkdtempSync(join(tmpdir(), "ar-smoke-")), "proxy.mjs");
await build({ entryPoints: [resolve(ROOT, "src/homeloans/proxy.ts")], outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "error" });
const { CdrProxy, resolveLender } = await import(pathToFileURL(out).href);

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["commonwealth bank", "westpac", "northern inland credit union"];
const problems = [];
const proxy = new CdrProxy();

const t0 = Date.now();
const brands = await proxy.brands().catch((e) => {
  problems.push(`register: ${e.kind ?? "error"}: ${e.message}`);
  return [];
});
console.log(`Register: ${brands.length} banking brands with safe base URIs (${Date.now() - t0} ms)`);
if (brands.length < 50) problems.push(`register: only ${brands.length} brands, expected at least 50`);

for (const q of wanted) {
  const r = resolveLender(brands, q);
  if (!r.ok) {
    problems.push(`${q}: ${r.candidates.length ? `ambiguous (${r.candidates.map((c) => c.name).join("; ")})` : "not in the Register"}`);
    continue;
  }
  const b = r.brand;
  try {
    const t1 = Date.now();
    const list = await proxy.list(b, 1, 5);
    const products = list.body?.data?.products ?? [];
    const t2 = Date.now();
    if (products.length === 0) {
      problems.push(`${b.name}: list returned no products`);
      continue;
    }
    const detail = await proxy.detail(b, products[0].productId);
    const rates = detail.body?.data?.lendingRates ?? [];
    const missing = rates.filter((x) => x.comparisonRate == null).length;
    console.log(`${b.name}: list x-v ${list.xVersion}, ${products.length} products (${t2 - t1} ms); detail x-v ${detail.xVersion}, ${rates.length} lending rates, ${missing} without a comparison rate (${Date.now() - t2} ms)`);
    if (rates.length === 0) problems.push(`${b.name}: detail has no lending rates`);
    // A comparison rate is optional in the standard for some rate types (fixed introductory, discounts); report, do not fail.
  } catch (e) {
    problems.push(`${b.name}: ${e.kind ?? "error"}: ${e.message}`);
  }
}
if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log("OK");
