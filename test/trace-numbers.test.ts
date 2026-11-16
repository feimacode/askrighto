import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { traceNumbers } from "../scripts/trace-numbers.mjs";

type Run = { prompt?: string; toolResults?: string[]; answer?: string };
const trace = traceNumbers as (r: Run) => { raw: string }[];

describe("traceNumbers", () => {
  it("passes figures that appear in a tool result, ignoring commas and trailing zeros", () => {
    const r = trace({ toolResults: ["Estimated yearly cost 1,234.50 dollars"], answer: "About 1234.5 a year." });
    expect(r).toEqual([]);
  });

  it("passes figures the user gave", () => {
    expect(trace({ prompt: "I used 800 kWh over 90 days", answer: "For 800 kWh over 90 days." })).toEqual([]);
  });

  it("flags an invented figure with its position", () => {
    const r = trace({ toolResults: ["cost 100"], answer: "That is 100, saving 250." });
    expect(r.map((f) => f.raw)).toEqual(["250"]);
  });

  it("flags rounded figures", () => {
    expect(trace({ toolResults: ["rank 94.55"], answer: "rank 95" }).map((f) => f.raw)).toEqual(["95"]);
  });

  it("ignores numbered list markers", () => {
    expect(trace({ toolResults: ["a"], answer: "1. one\n2. two" })).toEqual([]);
  });
});
