import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serverInstructions } from "../src/server/instructions.js";
import { BASE_RULES } from "../src/guidance/shared.js";

const ROOT = resolve(import.meta.dirname, "..");
const SKILLS = join(ROOT, "plugin/skills");
const INTERNAL = join(ROOT, "plugin-internal/skills");
const ALL = [SKILLS, INTERNAL];
const skillDirs = () => ALL.flatMap((d) => readdirSync(d).map((n) => join(d, n)));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("skill bundle", () => {
  it("has a manifest, a marketplace entry and at least one skill", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "plugin/.claude-plugin/plugin.json"), "utf8"));
    expect(manifest.description).toBeTruthy();
    const market = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8"));
    expect(market.plugins[0].source).toBe("./plugin");
    expect(readdirSync(SKILLS).length).toBeGreaterThan(0);
  });

  it("holds no agents, hooks or user config", () => {
    const files = [...walk(join(ROOT, "plugin")), ...walk(join(ROOT, "plugin-internal"))];
    expect(files.some((f) => /\/(agents|hooks)\//.test(f))).toBe(false);
    expect(readFileSync(join(ROOT, "plugin/.claude-plugin/plugin.json"), "utf8")).not.toMatch(/userConfig|hooks|agents/);
  });

  it("gives every skill a name and description matching its folder", () => {
    for (const full of skillDirs()) {
      const dir = full.split("/").pop()!;
      const text = readFileSync(join(full, "SKILL.md"), "utf8");
      const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
      expect(fm).toMatch(new RegExp(`^name: ${dir}$`, "m"));
      expect(fm).toMatch(/^description: .{20,}/m);
    }
  });

  it("uses provider-neutral wording in skill files", () => {
    for (const f of ALL.flatMap(walk)) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\b(Claude|ChatGPT|OpenAI|Gemini|Anthropic)\b/i);
    }
  });

  it("puts the user first in the grounding skill", () => {
    const text = readFileSync(join(SKILLS, "ask-righto-grounding/SKILL.md"), "utf8");
    expect(text).toMatch(/follow the user/i);
  });
});

describe("shared rules", () => {
  it("are in the server instructions", () => {
    const text = serverInstructions();
    for (const r of BASE_RULES) expect(text).toContain(r);
  });

  it("match the generated skill reference", () => {
    expect(() => execFileSync("node", ["scripts/guidance.mjs", "--check"], { cwd: ROOT, stdio: "pipe" })).not.toThrow();
  });
});

describe("vertical skills", () => {
  it("only name tools that exist and hold no real price claims", async () => {
    const { allTools } = await import("../src/tools/index.js");
    const { coursesVertical } = await import("../src/courses/vertical.js");
    const { internationalVertical } = await import("../src/intl/vertical.js");
    const { homeLoansVertical } = await import("../src/homeloans/vertical.js");
    const { healthVertical } = await import("../src/health/vertical.js");
    const names = new Set(
      [...allTools, ...coursesVertical.tools, ...internationalVertical.tools, ...healthVertical.tools, ...homeLoansVertical.tools].map((t) => t.name),
    );
    for (const f of ALL.flatMap(walk).filter((p) => p.endsWith(".md"))) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/`((?:get|search|compare|list|check|estimate)_[a-z_]+)`/g)) {
        expect(names.has(m[1]!), `${f}: ${m[1]}`).toBe(true);
      }
    }
  });

  it("labels the energy worked example as invented and uses no currency amounts", () => {
    const text = readFileSync(join(SKILLS, "energy-compare/references/worked-example.md"), "utf8");
    expect(text).toMatch(/invented/i);
    expect(text).not.toMatch(/\$\s?\d/);
  });

  it("keeps odds and aggregate-to-ATAR rules in the domestic course skill", () => {
    const text = readFileSync(join(INTERNAL, "domestic-course-research/SKILL.md"), "utf8");
    expect(text).toMatch(/will get in/);
    expect(text).toMatch(/convert an aggregate or a rank/i);
    expect(text).toMatch(/bot check/i);
  });

  const DOMESTIC_SKILLS = [
    "domestic-course-research",
    "subject-prerequisite-check",
    "course-compare",
    "admissions-timeline",
    "entry-pathways",
    "scaling-reader",
    "interstate-applicant",
  ];

  it("has the domestic course skills, each valid and each keeping the shared rules", () => {
    for (const n of DOMESTIC_SKILLS) {
      const text = readFileSync(join(INTERNAL, n, "SKILL.md"), "utf8");
      expect(text, n).toMatch(new RegExp(`^---\\nname: ${n}\\ndescription: Use when `));
      expect(text, n).toMatch(/will get in/);
      expect(text, n).toMatch(/bot check/i);
      expect(text, n).toMatch(/Send what you read back|send what you read back/);
      expect(text, n).toMatch(/from memory|ask righto holds no|Ask Righto holds only/i);
    }
  });

  it("does not leave the old VCE-only skill behind", () => {
    expect(existsSync(join(INTERNAL, "vce-course-research"))).toBe(false);
  });

  it("keeps state notes to structure facts: no score, percentage, year or date", () => {
    for (const f of ["README", "vce", "hsc", "act", "qce"]) {
      const text = readFileSync(join(INTERNAL, "domestic-course-research/references", `${f}.md`), "utf8");
      expect(text, f).not.toMatch(/\d{2,}/);
      expect(text, f).not.toMatch(/%|\bper cent\b/i);
    }
  });

  it("each state note says what is unconfirmed or to read the page", () => {
    for (const f of ["vce", "hsc", "act", "qce"]) {
      const text = readFileSync(join(INTERNAL, "domestic-course-research/references", `${f}.md`), "utf8");
      expect(text, f).toMatch(/Unconfirmed/);
    }
  });

  it("keeps the no-visa-advice rule in the international skill", () => {
    const text = readFileSync(join(INTERNAL, "intl-course-finder/SKILL.md"), "utf8");
    expect(text).toMatch(/visa, migration/i);
    expect(text).toMatch(/indicative/i);
  });
});

describe("home loan skill", () => {
  it("keeps the no-advice rules and uses no currency amounts in its worked example", () => {
    const skill = readFileSync(join(INTERNAL, "home-loan-comparison/SKILL.md"), "utf8");
    expect(skill).toMatch(/Never/);
    expect(skill).toMatch(/approved/);
    expect(skill).toMatch(/refinance or switch/);
    const rules = readFileSync(join(INTERNAL, "home-loan-comparison/references/rules.md"), "utf8");
    for (const r of ["suitability", "approval", "switching", "application"]) expect(rules.toLowerCase()).toContain(r === "suitability" ? "which loan suits me" : r === "approval" ? "approved" : r === "switching" ? "refinance" : "apply for me");
    const ex = readFileSync(join(INTERNAL, "home-loan-comparison/references/worked-example.md"), "utf8");
    expect(ex).toMatch(/invented/i);
  });
});

describe("public bundle", () => {
  it("contains no course skill until the verticals are promoted", () => {
    const names = readdirSync(SKILLS);
    expect(names.filter((n) => /course|loan/.test(n))).toEqual([]);
    expect(names.filter((n) => /health/.test(n))).toEqual([]);
    const market = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8"));
    expect(market.plugins.find((p: { name: string }) => p.name === "askrighto").source).toBe("./plugin");
  });
});
