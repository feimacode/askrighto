import { describe, expect, it } from "vitest";
import { brandKey, canonicalBrand } from "../../src/energy/brands.js";

describe("canonicalBrand", () => {
  it("makes spellings of one brand a single name", () => {
    expect(canonicalBrand("Globird Energy")).toBe("GloBird Energy");
    expect(canonicalBrand("GLOBIRD ENERGY")).toBe("GloBird Energy");
    expect(canonicalBrand("GloBird Energy")).toBe("GloBird Energy");
    expect(canonicalBrand("Dodo")).toBe("Dodo Power & Gas");
    expect(canonicalBrand("Lumo Energy (SA)")).toBe("Lumo Energy");
    expect(canonicalBrand("  Origin   Energy ")).toBe("Origin Energy");
  });

  it("knows the brands served from another retailer's path", () => {
    expect(canonicalBrand("INDIGO POWER")).toBe("Indigo Power");
    expect(canonicalBrand("Arcline")).toBe("ARCLINE");
  });

  it("keeps an unknown brand as published, tidied", () => {
    expect(canonicalBrand("  Some  New Brand ")).toBe("Some New Brand");
  });

  it("does not merge different brands", () => {
    expect(brandKey("Energy Locals Retail")).not.toBe(brandKey("Energy Locals Urban"));
    expect(brandKey("Sumo")).toBe(brandKey("Sumo Power"));
    expect(brandKey("Red Energy")).not.toBe(brandKey("Origin Energy"));
  });
});
