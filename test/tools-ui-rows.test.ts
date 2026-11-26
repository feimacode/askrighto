import { describe, expect, it } from "vitest";
import { found } from "../src/core/grounded.js";
import { inkviewResult, UI_MAX_ROWS } from "../src/tools/energy-common.js";

const result = (n: number) =>
  found({
    data: { rows: Array.from({ length: n }, (_, i) => i) },
    source: { name: "Test source", url: "https://example.com/", licence: "CC BY 4.0" },
    asOf: "2026-11-23T00:00:00Z",
  });

describe("inkviewResult row guard", () => {
  const build = () => ({ content: [], structuredContent: { component: "x" } });

  it("draws the component up to the row cap", () => {
    expect(inkviewResult(result(UI_MAX_ROWS), build, { rowsKey: "rows" })).toBeDefined();
  });

  it("skips the component above the cap, leaving text and data to the host", () => {
    expect(inkviewResult(result(UI_MAX_ROWS + 1), build, { rowsKey: "rows" })).toBeUndefined();
  });

  it("ignores the cap when no rows key is given", () => {
    expect(inkviewResult(result(UI_MAX_ROWS + 5), build)).toBeDefined();
  });
});
