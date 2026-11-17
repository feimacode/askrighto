import { describe, expect, it } from "vitest";
import { RETAILERS } from "../../src/energy/index.js";

describe("retailers.json", () => {
  it("lists the CDR retailers by their base URI path segment, each once", () => {
    const slugs = RETAILERS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // The path segment goes into the request URL, so it must be a plain slug.
    for (const r of RETAILERS) {
      expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(r.brandName.trim()).not.toBe("");
      expect(r.active).toBe(true);
    }
    // AER "Energy Retailer Base URIs and CDR Brands", January 2026, has more than 80 paths.
    expect(RETAILERS.length).toBeGreaterThan(80);
    expect(slugs).toEqual(expect.arrayContaining(["agl", "origin", "energyaustralia", "alinta", "red-energy", "simply-energy", "energy-locals"]));
  });

  it("has one entry for brands that share a path (they come back from the same endpoint)", () => {
    const slugs = RETAILERS.map((r) => r.slug);
    // ARCLINE, Cooperative Power, RAA Energy, Indigo Power and Sonnen are served from /energy-locals/;
    // MYOB and OVO Energy for CTM from /ovo-energy/; SunSwitch from /future-x/.
    for (const brand of ["arcline", "cooperative", "raa", "indigo", "sonnen", "myob", "ovo-energy-ctm", "sunswitch"]) expect(slugs).not.toContain(brand);
  });
});
