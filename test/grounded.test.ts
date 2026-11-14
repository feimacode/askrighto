import { describe, expect, it } from "vitest";
import { found, notFound, renderText, sourceFooter } from "../src/core/grounded.js";

const source = { name: "Test publisher", url: "https://example.org/data", licence: "CC BY 4.0" };

describe("grounded results", () => {
  it("builds a found result with source and as-of date", () => {
    const r = found({ data: { price: 1 }, source, asOf: "2026-11-13T00:00:00Z" });
    expect(r).toMatchObject({ found: true, data: { price: 1 }, source, asOf: "2026-11-13T00:00:00Z" });
  });

  it("accepts a Date for asOf and stores ISO text", () => {
    const r = found({ data: 1, source, asOf: new Date("2026-11-13T00:00:00Z") });
    expect(r.asOf).toBe("2026-11-13T00:00:00.000Z");
  });

  it("refuses a found result without a usable as-of date or source", () => {
    expect(() => found({ data: 1, source, asOf: "not a date" })).toThrow(/asOf/);
    expect(() => found({ data: 1, source: { ...source, url: "" }, asOf: new Date() })).toThrow(/source/);
  });

  it("builds an explicit not-found with a reason and no data", () => {
    const r = notFound("outside_coverage", "No plans for that postcode.", { states: ["NSW"] });
    expect(r).toEqual({ found: false, reason: "outside_coverage", message: "No plans for that postcode.", details: { states: ["NSW"] } });
    expect("data" in r).toBe(false);
  });

  it("ends the text form with the source name, link, licence and date", () => {
    const r = found({ data: "x", source: { ...source, attribution: "© State of Victoria" }, asOf: "2026-11-13T00:00:00Z" });
    const text = renderText(r, (d) => `Body ${d}`);
    expect(text).toContain("Body x");
    expect(text).toContain("Source: Test publisher (https://example.org/data), licence: CC BY 4.0. As of 2026-11-13T00:00:00Z.");
    expect(text.endsWith("© State of Victoria")).toBe(true);
    expect(sourceFooter(r)).toContain("© State of Victoria");
  });

  it("shows warnings before the footer", () => {
    const r = found({ data: "x", source, asOf: "2026-11-13T00:00:00Z", warnings: ["Data is old."] });
    const text = renderText(r, () => "Body");
    expect(text.indexOf("Warning: Data is old.")).toBeLessThan(text.indexOf("Source:"));
  });

  it("renders a not-found as just its message", () => {
    expect(renderText(notFound("not_in_dataset", "Unknown plan."), () => "never")).toBe("Unknown plan.");
  });
});
