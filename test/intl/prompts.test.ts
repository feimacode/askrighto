import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";
// @ts-expect-error plain .mjs script, no types
import { parseChecks } from "../../scripts/evals/lib.mjs";

const md = readFileSync("docs/use-case-comparison/prompts.md", "utf8");
const rows = [
  ...md.matchAll(/^\| ([DI]\d\d) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|$/gm),
];
const tools = routeSet(
  ALL_VERTICALS,
  ALL_VERTICALS.map((v) => v.id),
).tools;
const known = new Set(tools.map((t) => t.name));

describe("comparison prompt sets", () => {
  it("number the prompts D01 to D31 and I01 to I30 without gaps", () => {
    for (const [letter, n] of [
      ["D", 31],
      ["I", 30],
    ] as const)
      expect(
        rows.filter((r) => r[1]!.startsWith(letter)).map((r) => r[1]),
      ).toEqual(
        Array.from(
          { length: n },
          (_, i) => `${letter}${String(i + 1).padStart(2, "0")}`,
        ),
      );
  });
  it("write mechanical checks that parse and name real tools and arguments", () => {
    for (const r of rows) {
      const checks = parseChecks(r[5]!.trim());
      for (const c of checks.filter((x: { kind: string }) => x.kind === "arg")) {
        const tool = tools.find((t) => t.name === c.tool);
        expect(tool, `${r[1]}: ${c.raw}`).toBeDefined();
        const shape = (
          tool as unknown as { inputSchema: { shape: Record<string, unknown> } }
        ).inputSchema.shape;
        expect(Object.keys(shape), `${r[1]}: ${c.raw}`).toContain(c.key);
      }
    }
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
