import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";
// @ts-expect-error plain .mjs script, no types
import { loadSet, parseChecks } from "../../scripts/evals/lib.mjs";

const known = new Set(routeSet(ALL_VERTICALS, ["home-loans"]).tools.map((t) => t.name));
const rows = loadSet("home-loans") as { id: string; expectedTools: string[]; checks: { kind: string; tool?: string; key?: string }[] }[];

describe("home loan prompt set v2", () => {
  it("numbers H01 to H30 without gaps", () => {
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 30 }, (_, i) => `H${String(i + 1).padStart(2, "0")}`));
  });
  it("names only registered tools, and none of the retired ones", () => {
    for (const r of rows) for (const t of r.expectedTools) expect(known.has(t), `${r.id}: ${t}`).toBe(true);
  });
  it("uses the proxy tools for lender data", () => {
    expect(rows.find((r) => r.id === "H26")!.expectedTools).toEqual(["list_home_loan_lenders", "get_home_loan_products"]);
  });
  it("has checks that parse and arg checks that name a real argument", () => {
    const md = readFileSync("docs/home-loan-evaluation/prompts.md", "utf8");
    for (const m of md.matchAll(/^\| H\d\d \| .+? \| .+? \| .+? \| (.+?) \|$/gm)) expect(() => parseChecks(m[1])).not.toThrow();
    const tools = routeSet(ALL_VERTICALS, ["home-loans"]).tools;
    for (const r of rows)
      for (const c of r.checks.filter((c) => c.kind === "arg")) {
        const t = tools.find((x) => x.name === c.tool);
        expect(t, `${r.id}: ${c.tool}`).toBeDefined();
        expect(JSON.stringify(t!.inputSchema), `${r.id}: ${c.key}`).toContain(`"${c.key}"`);
      }
  });
});
