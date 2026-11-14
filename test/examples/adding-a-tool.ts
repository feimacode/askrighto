// This file is the worked example in docs/adding-a-tool.md. It exists so the typecheck keeps the doc honest.
import { z } from "zod";
import { defineTool } from "../../src/core/define-tool.js";
import { found, notFound } from "../../src/core/grounded.js";

const RATES: Record<string, number> = { VIC: 1 };

export const getExampleRate = defineTool({
  name: "get_example_rate",
  title: "Get example rate",
  description: "Looks up an example rate for a state. Use it only as a template.",
  inputSchema: z.object({ state: z.enum(["VIC", "NSW"]).describe("Australian state code") }),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: ({ state }) => {
    const rate = RATES[state];
    if (rate === undefined) return notFound("not_in_dataset", `No example rate for ${state}.`);
    return found({
      data: { state, rate },
      source: { name: "Example source", url: "https://example.org/rates", licence: "CC BY 4.0" },
      asOf: new Date("2026-01-01"),
    });
  },
  render: (d) => `${d.state}: ${d.rate}`,
});
