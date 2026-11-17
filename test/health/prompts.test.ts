import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bannedInHealth } from "../../src/health/notice.js";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";

const md = readFileSync("docs/use-case-comparison/health-prompts.md", "utf8");
const rows = [...md.matchAll(/^\| (H\d\d) \| (.+?) \| (.+?) \| (.+?) \|$/gm)];
const known = new Set(routeSet(ALL_VERTICALS, ALL_VERTICALS.map((v) => v.id)).tools.map((t) => t.name));

describe("health cover prompt set and skill", () => {
  it("holds twenty prompts that name only tools that exist and say what a grounded answer holds", () => {
    expect(rows).toHaveLength(20);
    for (const r of rows) {
      expect(r[4]!.length, r[1]).toBeGreaterThan(10);
      for (const t of r[3]!.split(",").map((x) => x.trim()).filter((x) => !x.startsWith("(")))
        expect(known.has(t), `${r[1]}: ${t}`).toBe(true);
    }
  });
  it("keeps banned wording out of the skill except in its list of forbidden words", () => {
    const skill = readFileSync("plugin-internal/skills/health-cover-comparison/SKILL.md", "utf8");
    const outside = skill.split("\n").filter((l) => !/^## Wording|^Say "the lowest|^- Recommend a product/.test(l) && !/Never say best/.test(l));
    expect(bannedInHealth(outside.join("\n")).length).toBeLessThanOrEqual(4);
    expect(skill).toMatch(/not law/);
    expect(skill).toMatch(/not an insurer, broker or adviser/);
  });
});
