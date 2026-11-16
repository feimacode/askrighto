import { describe, expect, it } from "vitest";
import {
  parseVerticalFlags,
  routeSet,
  markVerticalFailed,
  clearFailedVerticals,
  type Vertical,
} from "../src/verticals.js";
import { defineTool } from "../src/core/define-tool.js";
import { z } from "zod";
import { found } from "../src/core/grounded.js";

const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;

describe("vertical flags", () => {
  it("defaults to energy, loaded and public", () => {
    expect(parseVerticalFlags(env({}))).toEqual({
      loaded: ["energy"],
      public: ["energy"],
    });
  });
  it("lets the public list be a subset", () => {
    expect(
      parseVerticalFlags(
        env({
          ASKRIGHTO_VERTICALS: "energy,courses",
          ASKRIGHTO_PUBLIC_VERTICALS: "energy",
        }),
      ),
    ).toEqual({ loaded: ["energy", "courses"], public: ["energy"] });
  });
  it("defaults public to everything loaded", () => {
    expect(
      parseVerticalFlags(env({ ASKRIGHTO_VERTICALS: "energy,courses" })).public,
    ).toEqual(["energy", "courses"]);
  });
  it("fails on an unknown name and names it", () => {
    expect(() =>
      parseVerticalFlags(env({ ASKRIGHTO_VERTICALS: "energy,cuorses" })),
    ).toThrow(/cuorses/);
  });
  it("fails on an empty list", () => {
    expect(() => parseVerticalFlags(env({ ASKRIGHTO_VERTICALS: " " }))).toThrow(
      /empty/,
    );
  });
  it("fails when a public vertical is not loaded and names it", () => {
    expect(() =>
      parseVerticalFlags(
        env({
          ASKRIGHTO_VERTICALS: "energy",
          ASKRIGHTO_PUBLIC_VERTICALS: "energy,courses",
        }),
      ),
    ).toThrow(/courses/);
  });
});

const mk = (id: Vertical["id"], tool: string): Vertical => ({
  id,
  instructions: `${id} guidance`,
  start: async () => undefined,
  tools: [
    defineTool({
      name: tool,
      title: "t",
      description: "d",
      inputSchema: z.object({}),
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      handler: () =>
        found({
          data: {},
          source: { name: "s", url: "https://example.org", licence: "l" },
          asOf: "2026-11-15T00:00:00Z",
        }),
      render: () => "x",
    }),
  ],
});

describe("route sets", () => {
  const all = [
    mk("energy", "get_energy_thing"),
    mk("courses", "get_course_thing"),
  ];
  it("shows a route only its own verticals' tools and instructions", () => {
    const pub = routeSet(all, ["energy"]);
    expect(pub.tools.map((t) => t.name)).toEqual([
      "get_energy_thing",
      "list_data_sources",
    ]);
    expect(pub.instructions).toEqual(["energy guidance"]);
    const internal = routeSet(all, ["energy", "courses"]);
    expect(internal.tools.map((t) => t.name)).toContain("get_course_thing");
  });
  it("answers data_unavailable from a vertical that failed to start", async () => {
    markVerticalFailed("courses", "tables missing");
    try {
      const t = routeSet(all, ["courses"]).tools.find(
        (x) => x.name === "get_course_thing",
      )!;
      expect(await t.handler({})).toMatchObject({
        found: false,
        reason: "data_unavailable",
      });
    } finally {
      clearFailedVerticals();
    }
  });
});
