import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts, no types
import * as lib from "../../scripts/evals/lib.mjs";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";

type Row = { id: string; prompt: string; expectedTools: string[]; must: string; key: string };
const known = new Set(routeSet(ALL_VERTICALS, ALL_VERTICALS.map((v) => v.id)).tools.map((t) => t.name));

describe("energy eval prompt set", () => {
  const rows = lib.loadSet("energy") as Row[];

  it("holds thirty-one prompts that name only tools that exist and say what a grounded answer holds", () => {
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 31 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`));
    for (const r of rows) {
      expect(r.must.length, r.id).toBeGreaterThan(20);
      for (const t of r.expectedTools) expect(known.has(t), `${r.id}: ${t}`).toBe(true);
    }
  });

  it("covers each energy tool and the readings route", () => {
    const used = new Set(rows.flatMap((r) => r.expectedTools));
    for (const t of ["search_energy_plans", "get_energy_plan", "compare_energy_plans", "compare_energy_plan_rates", "summarise_interval_readings", "list_current_plan_options", "get_readings_upload_link"]) expect(used.has(t), t).toBe(true);
    expect(rows.some((r) => r.expectedTools.length === 0)).toBe(true);
  });

  it("expands the sample files, with invented identifiers, and leaves no placeholder", () => {
    for (const r of rows) expect(r.prompt, r.id).not.toMatch(/\{\{|\\n/);
    const e11 = rows.find((r) => r.id === "E11")!.prompt;
    expect(e11).toMatch(/^200,6407000123,E1,/m);
    expect(e11.match(/^300,/gm)).toHaveLength(3);
    expect(rows.find((r) => r.id === "E12")!.prompt).toMatch(/^250,/m);
    expect(rows.find((r) => r.id === "E13")!.prompt.match(/^200,/gm)).toHaveLength(2);
  });

  it("holds no real NMI and the loader serves only fixture data", () => {
    const md = readFileSync("docs/energy-evaluation/prompts.md", "utf8");
    const ids = [...(md + rows.map((r) => r.prompt).join("\n")).matchAll(/\b\d{10,11}\b/g)].map((m) => m[0]);
    for (const id of ids) expect(["6407000123", "6407000999"], `unexpected identifier ${id.slice(0, 3)}...`).toContain(id);
    const loader = readFileSync("scripts/evals/load-energy-fixtures.mjs", "utf8");
    expect(loader).toMatch(/test\/fixtures\/energy/);
    expect(loader).not.toMatch(/energymadeeasy\.gov\.au/);
  });
});
