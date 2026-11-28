import { describe, expect, it } from "vitest";
import { wordMatches } from "../../src/tools/intl-tools.js";

describe("course search word matching", () => {
  it("matches an acronym only as a whole word", () => {
    expect(wordMatches("bachelor of ai", "ai")).toBe(true);
    expect(wordMatches("bachelor of information technology (ai and data science)", "ai")).toBe(true);
    for (const name of [
      "bachelor of fashion sustainability",
      "bachelor of arts and entertainment management",
      "bachelor of aviation (pilot training)",
      "bachelor of applied business",
    ])
      expect(wordMatches(name, "ai")).toBe(false);
  });

  it("matches the start of a longer word", () => {
    expect(wordMatches("bachelor of engineering (honours)", "engineer")).toBe(true);
    expect(wordMatches("bachelor of data science", "science")).toBe(true);
    expect(wordMatches("bachelor of nursing", "sing")).toBe(false);
  });
});
