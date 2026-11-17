import { describe, expect, it } from "vitest";
import {
  classifyFile,
  dateInName,
  HealthAccumulator,
  parseHealthDir,
  parseHealthFiles,
  ProductSplitter,
} from "../../src/health/parse.js";
import { categoriesOf } from "../../src/health/types.js";
import { FIXTURE_DIR, fixtureXml } from "./helpers.js";

describe("health parser (real PHIO V3.1 layout)", () => {
  const r = parseHealthFiles(fixtureXml());
  it("keeps open products, skips closed, reports the repeated ProductID and no problems", () => {
    expect(r.report.problems).toEqual([]);
    expect(r.report.insurers).toBe(2);
    expect(r.report.productsRead).toBe(8);
    expect(r.report.productsKept).toBe(6);
    expect(r.report.closedSkipped).toBe(1);
    expect(r.report.duplicateIds).toEqual(["tst-gold"]);
    expect(r.report.unknownFunds).toEqual([]);
    expect(r.report.byKind).toEqual({ hospital: 4, combined: 1, general_treatment: 1 });
    expect(r.report.productsWithoutPremium).toBe(1);
    expect(parseHealthFiles(fixtureXml(), { includeClosed: true }).report.productsKept).toBe(7);
  });
  it("stores money as cents, the premium as monthly and before rebate, and the file's own tier and category titles", () => {
    const gold = r.products.find((p) => p.id === "tst-gold")!;
    expect(gold.name).toBe("Test Gold Hospital");
    expect(gold.excessCents).toBe(25000);
    expect(gold.excessType).toBe("LimitedPerPerson");
    expect(gold.premiums).toEqual([{ amountCents: 20000, frequency: "monthly", basis: "before_rebate" }]);
    expect(gold.tier).toBe("Gold");
    expect(r.categoryTitles).toEqual(["PregnancyBirth", "JointReconstructions", "PsychiatricServices"]);
    expect(categoriesOf(r, gold).map((c) => `${c.code}:${c.cover}`)).toEqual([
      "PregnancyBirth:covered",
      "JointReconstructions:covered",
      "PsychiatricServices:restricted",
    ]);
    expect(gold.waiting).toEqual([
      { type: "PreExisting", months: 12 },
      { type: "PregnancyBirth", months: 12 },
    ]);
    expect(gold.infoUrl).toBe("https://example.org/testfund/gold");
    expect(gold.mlsExempt).toBe(true);
    expect(gold.state).toBe("VIC");
  });
  it("derives household from WhoIsCovered and never from a guess", () => {
    const h = (id: string) => r.products.find((p) => p.id === id)!.household;
    expect(h("tst-gold")).toBe("single");
    expect(h("tst-couple")).toBe("couple");
    expect(h("tst-rst-family")).toBe("family");
    expect(r.products.find((p) => p.id === "tst-rst-family")!.dependantsCovered).toEqual(["Child", "Student"]);
  });
  it("takes the hospital component, corporate and fund restriction as published", () => {
    expect(r.products.find((p) => p.id === "tst-combo")).toMatchObject({ kind: "combined", hospitalComponentCents: 11000 });
    expect(r.products.find((p) => p.id === "tst-rst-family")).toMatchObject({ corporate: true, excessCents: 0, excessType: "None" });
    expect(r.insurers.find((i) => i.id === "rst")).toMatchObject({ fundType: "restricted", restrictionHint: "Employees of the test union" });
  });
  it("leaves unpublished facts unset", () => {
    const c = r.products.find((p) => p.id === "tst-couple")!;
    expect(c.excessCents).toBeUndefined();
    expect(c.infoUrl).toBeUndefined();
    const x = r.products.find((p) => p.id === "tst-extras")!;
    expect(x.premiums).toEqual([]);
    expect(x.coverCodes).toBe("");
  });
  it("collects a problem for invalid or unrecognised content instead of throwing", () => {
    const a = new HealthAccumulator();
    a.addFunds("<Funds><Fund>");
    a.addProduct("<Product><Name>x</Name></Product>");
    a.addProduct("<Product");
    expect(a.finish().report.problems.length).toBe(3);
  });
  it("cuts a stream at any chunk boundary", () => {
    const xml = fixtureXml().find((f) => f.name.startsWith("Hospital Open"))!.xml;
    const whole = new ProductSplitter().feed(xml);
    for (const size of [1, 7, 64, 1000]) {
      const sp = new ProductSplitter();
      const got: string[] = [];
      for (let i = 0; i < xml.length; i += size) got.push(...sp.feed(xml.slice(i, i + size)));
      expect(got).toEqual(whole);
    }
    expect(whole.length).toBe(5);
  });
  it("streams a folder, hashes it, reads the date from the file names and agrees with the in-memory parser", async () => {
    const d = await parseHealthDir(FIXTURE_DIR);
    expect(d.products.map((p) => p.id).sort()).toEqual(r.products.map((p) => p.id).sort());
    expect(d.fileDate).toBe("2026-11-03");
    expect(d.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(d.report.problems).toEqual([]);
  });
  it("classifies file names", () => {
    expect(classifyFile("Funds 02-Nov-2026.xml")).toBe("funds");
    expect(classifyFile("Combined Open 02-Nov-2026.xml")).toBe("products");
    expect(classifyFile("PHOLSchema-V3.1.xsd")).toBeUndefined();
    expect(classifyFile("Product Changes 02-Nov-2026.csv")).toBeUndefined();
    expect(dateInName("Funds 02-Nov-2026.xml")).toBe("2026-11-02");
  });
});
