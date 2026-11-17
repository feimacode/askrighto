import { describe, expect, it } from "vitest";
import { parseHealthFiles } from "../../src/health/parse.js";
import { fixtureXml } from "./helpers.js";

describe("health parser (assumed layout)", () => {
  const r = parseHealthFiles(fixtureXml());
  it("keeps products, reports the duplicate key and no problems", () => {
    expect(r.report.problems).toEqual([]);
    expect(r.report.insurers).toBe(1);
    expect(r.report.productsRead).toBe(6);
    expect(r.report.productsKept).toBe(5);
    expect(r.report.duplicateKeys).toEqual(["tst/tst-gold/VIC/single"]);
  });
  it("stores money as cents and keeps the file's tier and category codes", () => {
    const gold = r.products.find((p) => p.code === "TST-GOLD")!;
    expect(gold.excessCents).toBe(25000);
    expect(gold.premiums).toEqual([{ amountCents: 20000, frequency: "monthly", basis: "before_rebate" }]);
    expect(gold.tier).toBe("Gold");
    expect(gold.categories.map((c) => c.code)).toEqual(["PREG", "JOINT", "PSY"]);
    expect(gold.categories[2]!.cover).toBe("restricted");
    expect(gold.waiting).toEqual([{ type: "Pregnancy", months: 12 }]);
    expect(gold.infoUrl).toBe("https://example.org/testfund/gold.pdf");
  });
  it("leaves unpublished facts unset and basis unknown", () => {
    const nb = r.products.find((p) => p.code === "TST-NOBASIS")!;
    expect(nb.excessCents).toBeUndefined();
    expect(nb.infoUrl).toBeUndefined();
    expect(nb.premiums[0]!.basis).toBe("unknown");
    expect(r.products.find((p) => p.code === "TST-EXTRAS")!.premiums).toEqual([]);
    expect(r.report.productsWithoutPremium).toBe(1);
  });
  it("collects a problem for invalid or unrecognised files instead of throwing", () => {
    const bad = parseHealthFiles([
      { name: "a.xml", xml: "<Insurer><Name>x" },
      { name: "b.xml", xml: "<Other/>" },
    ]);
    expect(bad.report.problems.length).toBe(2);
    expect(bad.products).toEqual([]);
  });
});
