# Adding a tool

Every tool returns a grounded result: either `found({ data, source, asOf })` or
`notFound(reason, message)`. There is no third shape, so a tool cannot return a figure
without its source and date. The renderer adds a source footer to the text output.

`defineTool` checks the definition when the server starts, and the server refuses to start if:

- the name is not verb-first snake_case (`get_`, `search_`, `compare_`, `list_` ...);
- title or description is missing;
- `readOnlyHint`, `destructiveHint` or `openWorldHint` is missing;
- the input schema is nested (only scalars, enums and arrays of scalars are allowed).

Worked example (kept compiling in [`test/examples/adding-a-tool.ts`](../test/examples/adding-a-tool.ts)):

```ts
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
```

Then add the tool to `src/tools/index.ts`. Datasets register themselves with
`registerDataSet` (so `list_data_sources` and stale-data warnings work) and add a readiness
check with `addReadinessCheck` if the server cannot answer without them.
