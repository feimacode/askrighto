import { describe, expect, it } from "vitest";
import { sharedRun } from "../../src/courses/verbatim.js";

const page =
  "<html><script>var x=1;</script><p>Students complete a three year program covering design, analysis, and professional practice in engineering.</p></html>";

describe("verbatim run check", () => {
  it("finds a copied run of 12 words, ignoring markup and case", () => {
    const ours =
      "Overview: students complete a three year program covering design analysis and professional practice, as stated.";
    expect(sharedRun(ours, page)).toBeDefined();
  });
  it("passes text in our own words", () => {
    expect(
      sharedRun(
        "A three year engineering degree with design, analysis and workplace skills.",
        page,
      ),
    ).toBeUndefined();
  });
  it("ignores text shorter than the run", () => {
    expect(
      sharedRun("students complete a three year program", page),
    ).toBeUndefined();
  });
});
