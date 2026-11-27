import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_VERTICALS } from "../../src/server/route.js";
import { routeSet } from "../../src/verticals.js";
// @ts-expect-error plain .mjs scripts, no types
import * as lib from "../../scripts/evals/lib.mjs";

type Row = { id: string; prompt: string; expectedTools: string[]; must: string; checks: { kind: string; tool?: string; key?: string }[] };

const rows = lib.loadSet("home-loans") as Row[];
const tools = routeSet(ALL_VERTICALS, ["home-loans"]).tools;
const known = new Set(tools.map((t) => t.name));

describe("home loan prompt set (version 2)", () => {
  it("numbers the prompts H01 to H31 without gaps", () => {
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 31 }, (_, i) => `H${String(i + 1).padStart(2, "0")}`));
  });
  it("expects only registered tools, and the proxy tools where lender data is read", () => {
    for (const r of rows) for (const t of r.expectedTools) expect(known.has(t), `${r.id}: ${t}`).toBe(true);
    for (const id of ["H01", "H03", "H08", "H15", "H24", "H27"])
      expect(rows.find((r) => r.id === id)!.expectedTools).toEqual(
        expect.arrayContaining(["list_home_loan_lenders", "get_home_loan_products"]),
      );
  });
  it("keeps the refusal prompts H16 to H23 and H30 tool-free", () => {
    for (const id of ["H16", "H17", "H18", "H19", "H21", "H22", "H23", "H30"])
      expect(rows.find((r) => r.id === id)!.expectedTools, id).toEqual([]);
  });
  it("writes mechanical checks that parse and name real tools and arguments", () => {
    for (const r of rows)
      for (const c of r.checks.filter((x) => x.kind === "arg")) {
        const tool = tools.find((t) => t.name === c.tool) as unknown as { inputSchema: { shape: Record<string, unknown> } };
        expect(tool, `${r.id}`).toBeDefined();
        expect(Object.keys(tool.inputSchema.shape), `${r.id}`).toContain(c.key);
      }
  });
  it("reads the document version", () => {
    expect(readFileSync("docs/home-loan-evaluation/prompts.md", "utf8")).toMatch(/version 2/);
  });
});
