import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts, no types
import * as lib from "../scripts/evals/lib.mjs";
// @ts-expect-error plain .mjs scripts, no types
import { runPrompt } from "../scripts/evals/apiAgent.mjs";

type Row = { key: string; prompt: string; expectedTools: string[]; must: string; id: string; set: string };

describe("eval prompt sets", () => {
  it("reads every row of the default sets", () => {
    for (const [name, min] of [["domestic", 20], ["international", 15], ["health", 20]] as const) {
      const rows = lib.loadSet(name) as Row[];
      expect(rows.length).toBeGreaterThanOrEqual(min);
      for (const r of rows) {
        expect(r.prompt.length).toBeGreaterThan(5);
        expect(r.must.length).toBeGreaterThan(5);
      }
    }
  });

  it("treats (none) as no expected tools and splits lists", () => {
    const rows = lib.parsePromptTable(
      "| Id | P | T | M |\n| --- | --- | --- | --- |\n| D01 | q | a_tool, b_tool | must |\n| D02 | q2 | (none) | must |\n| X1 | skip | t | m |",
      /^D\d+$/,
    ) as Row[];
    expect(rows.map((r) => r.expectedTools)).toEqual([["a_tool", "b_tool"], []]);
  });

});

describe("scoreRun", () => {
  const row: Row = { id: "D01", set: "domestic", key: "domestic:D01", prompt: "Show courses", expectedTools: ["search_domestic_courses"], must: "m" };
  const base = { row, toolCalls: [{ name: "search_domestic_courses", args: {} }], toolResults: ["rank 80.05 in 2026"], answer: "Rank 80.05 in 2026." };

  it("passes when tools were called and figures trace", () => {
    expect(lib.scoreRun(base).pass).toBe(true);
  });
  it("fails on a missing tool", () => {
    const s = lib.scoreRun({ ...base, toolCalls: [] });
    expect(s.pass).toBe(false);
    expect(s.missingTools).toEqual(["search_domestic_courses"]);
  });
  it("fails on an untraced figure", () => {
    expect(lib.scoreRun({ ...base, answer: "Rank 91 in 2026." }).untraced).toEqual(["91"]);
  });
  it("fails when a tool is called although none was expected", () => {
    const s = lib.scoreRun({ ...base, row: { ...row, expectedTools: [] } });
    expect(s.unexpectedTools).toEqual(["search_domestic_courses"]);
    expect(s.pass).toBe(false);
  });
  it("flags banned wording without failing the run", () => {
    const s = lib.scoreRun({ ...base, answer: "This is the best course. Rank 80.05 in 2026." });
    expect(s.banned.map((b: { name: string }) => b.name)).toEqual(["best"]);
    expect(s.pass).toBe(true);
  });
  it("renders a report with a row per run", () => {
    const md = lib.renderReport({ label: "t", model: "m", startedAt: "now", runs: [{ row, n: 1, score: lib.scoreRun(base) }] });
    expect(md).toContain("| domestic:D01 | PASS |");
  });
});

describe("runPrompt", () => {
  it("loops through tool calls to a final answer", async () => {
    const replies = [
      { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "1", type: "function", function: { name: "t", arguments: "{\"a\":1}" } }] } }] },
      { choices: [{ message: { role: "assistant", content: "done 5" } }] },
    ];
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify(replies.shift()))) as typeof fetch;
    try {
      const r = await runPrompt({
        baseUrl: "http://x", apiKey: "k", model: "m", prompt: "p", tools: [],
        callTool: async () => ({ content: [{ type: "text", text: "5" }] }),
      });
      expect(r.answer).toBe("done 5");
      expect(r.toolCalls).toEqual([{ name: "t", args: { a: 1 } }]);
      expect(r.toolResults).toEqual(["5"]);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("model endpoint errors", () => {
  it("names the response when a 200 holds no message", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "model not found" } }))) as typeof fetch;
    try {
      await expect(runPrompt({ baseUrl: "http://x", apiKey: "k", model: "bad", prompt: "p", tools: [], callTool: async () => ({}) })).rejects.toThrow(/model not found/);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
