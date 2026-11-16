import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";

const md = readFileSync("docs/use-case-comparison/prompts.md", "utf8");
const rows = [
  ...md.matchAll(/^\| ([DI]\d\d) \| (.+?) \| (.+?) \| (.+?) \|$/gm),
];
const known = new Set(
  routeSet(
    ALL_VERTICALS,
    ALL_VERTICALS.map((v) => v.id),
  ).tools.map((t) => t.name),
);

describe("comparison prompt sets", () => {
  it("hold about twenty prompts for each use case", () => {
    expect(rows.filter((r) => r[1]!.startsWith("D"))).toHaveLength(20);
    expect(rows.filter((r) => r[1]!.startsWith("I"))).toHaveLength(20);
  });
  it("name only tools that exist, and say what a grounded answer must contain", () => {
    for (const r of rows) {
      expect(r[4]!.length, r[1]).toBeGreaterThan(10);
      for (const t of r[3]!
        .split(",")
        .map((x) => x.trim())
        .filter((x) => !x.startsWith("(")))
        expect(known.has(t), `${r[1]}: ${t}`).toBe(true);
    }
  });
});
