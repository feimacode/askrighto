import { describe, expect, it } from "vitest";
import { linkMarkdown, planLink, RETAILER_SITE_NOTE } from "../../src/energy/links.js";

const base = { brandName: "Test Retailer" };

describe("planLink", () => {
  it("builds the Energy Made Easy page for an @EME plan from the offer id and the postcode", () => {
    const l = planLink({ ...base, planId: "ENG1207222MRE@EME", postcode: "2000" });
    expect(l.url).toBe("https://www.energymadeeasy.gov.au/plan?id=ENG1207222MRE&postcode=2000");
    expect(l.label).toBe("Rate sheet on Energy Made Easy");
  });

  it("keeps a trailing version digit in the offer id", () => {
    expect(planLink({ ...base, planId: "ENG1112028MRE1@EME", postcode: "4000" }).url).toBe(
      "https://www.energymadeeasy.gov.au/plan?id=ENG1112028MRE1&postcode=4000",
    );
  });

  it("builds no Energy Made Easy link without a four-digit postcode, and says why", () => {
    for (const postcode of [undefined, "", "30"]) {
      const l = planLink({ ...base, planId: "X1@EME", ...(postcode !== undefined ? { postcode } : {}) });
      expect(l.url).toBeUndefined();
      expect(l.note).toMatch(/postcode/);
      expect(linkMarkdown(l)).toBe("no link available");
    }
  });

  it("links a Victorian plan to the retailer's website only, labelled as such, with the rate sheet note", () => {
    const l = planLink({ ...base, planId: "COV763326SR@VEC", postcode: "3000" }, "https://retailer.example/");
    expect(l).toEqual({ url: "https://retailer.example/", label: "Retailer website", note: RETAILER_SITE_NOTE });
    expect(l.url).not.toMatch(/energymadeeasy/);
  });

  it("gives a Victorian plan no link when the brand has no checked website", () => {
    const l = planLink({ ...base, planId: "COV763326SR@VEC" }, undefined);
    expect(l.url).toBeUndefined();
    expect(linkMarkdown(l)).toBe("no link available");
  });

  it("uses a link the retailer published first", () => {
    const l = planLink({ ...base, planId: "A@EME", postcode: "2000", publishedUrl: "https://retailer.example/plan" }, "https://retailer.example/");
    expect(l.url).toBe("https://retailer.example/plan");
  });

  it("never shows the plan id as a link when the id has no known source suffix", () => {
    const l = planLink({ ...base, planId: "O1", postcode: "2000" });
    expect(l.url).toBeUndefined();
    expect(linkMarkdown(l)).not.toContain("O1");
  });
});
