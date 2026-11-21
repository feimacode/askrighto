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

describe("mechanical checks", () => {
  const row = (checks: string) => ({
    id: "D21", set: "domestic", key: "domestic:D21", prompt: "q", expectedTools: ["search_domestic_courses"], must: "m",
    checks: lib.parseChecks(checks),
  });
  const run = (checks: string, o: Record<string, unknown> = {}) =>
    lib.scoreRun({
      row: row(checks),
      toolCalls: [{ name: "search_domestic_courses", args: { region: "qld", limit: 5 } }],
      toolResults: ["Sector: VET. HSC or QCE subject rules are not built"],
      answer: "These rules are not built yet.",
      ...o,
    });
  it("passes when every check holds", () => {
    expect(run("arg:search_domestic_courses.region=qld; says:not built/cannot; never:you will get in; result:HSC or QCE").pass).toBe(true);
  });
  it("compares arguments as text", () => {
    expect(run("arg:search_domestic_courses.limit=5").pass).toBe(true);
    expect(run("arg:search_domestic_courses.region=vic").failedChecks).toEqual(["arg:search_domestic_courses.region=vic"]);
  });
  it("fails on a missing phrase, a banned phrase or a missing result phrase", () => {
    expect(run("says:UAC").pass).toBe(false);
    expect(run("never:not built").pass).toBe(false);
    expect(run("result:certificate").pass).toBe(false);
  });
  it("reads a fifth column and treats - as none", () => {
    const rows = lib.parsePromptTable(
      "| Id | P | T | M | C |\n| --- | --- | --- | --- | --- |\n| D01 | q | t | m | - |\n| D02 | q | t | m | says:a/b; never:c |\n| D03 | q | t | m |",
      /^D\d+$/,
    ) as { checks: unknown[] }[];
    expect(rows.map((r) => r.checks.length)).toEqual([0, 2, 0]);
  });
  it("rejects an unknown check kind", () => {
    expect(() => lib.parseChecks("maybe:x")).toThrow(/unknown check kind/);
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
  it("accepts a completion wrapped in a data envelope", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ data: { choices: [{ message: { role: "assistant", content: "Ok" } }] } }))) as typeof fetch;
    try {
      const r = await runPrompt({ baseUrl: "http://x", apiKey: "k", model: "m", prompt: "p", tools: [], callTool: async () => ({}) });
      expect(r.answer).toBe("Ok");
    } finally {
      globalThis.fetch = orig;
    }
  });

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
