import { describe, expect, it, vi } from "vitest";
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
          ASKRIGHTO_VERTICALS: "energy,courses-domestic",
          ASKRIGHTO_PUBLIC_VERTICALS: "energy",
        }),
      ),
    ).toEqual({ loaded: ["energy", "courses-domestic"], public: ["energy"] });
  });
  it("defaults public to everything loaded", () => {
    expect(
      parseVerticalFlags(env({ ASKRIGHTO_VERTICALS: "energy,courses-domestic" })).public,
    ).toEqual(["energy", "courses-domestic"]);
  });
  it("fails on an unknown name and names it", () => {
    expect(() =>
      parseVerticalFlags(env({ ASKRIGHTO_VERTICALS: "energy,cuorses" })),
    ).toThrow(/cuorses/);
  });
  it("accepts the earlier ids with a warning and maps them to the new ones", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        parseVerticalFlags(
          env({
            ASKRIGHTO_VERTICALS: "energy,courses,international",
            ASKRIGHTO_PUBLIC_VERTICALS: "energy",
          }),
        ),
      ).toEqual({
        loaded: ["energy", "courses-domestic", "cricos"],
        public: ["energy"],
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"courses"'));
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('"international"'),
      );
    } finally {
      warn.mockRestore();
    }
  });
  it("does not list a vertical twice when the old and new id are both given", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        parseVerticalFlags(env({ ASKRIGHTO_VERTICALS: "energy,courses,courses-domestic" })).loaded,
      ).toEqual(["energy", "courses-domestic"]);
    } finally {
      warn.mockRestore();
    }
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
          ASKRIGHTO_PUBLIC_VERTICALS: "energy,courses-domestic",
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
    mk("courses-domestic", "get_course_thing"),
  ];
  it("shows a route only its own verticals' tools and instructions", () => {
    const pub = routeSet(all, ["energy"]);
    expect(pub.tools.map((t) => t.name)).toEqual([
      "get_energy_thing",
      "list_data_sources",
    ]);
    expect(pub.instructions).toEqual(["energy guidance"]);
    const internal = routeSet(all, ["energy", "courses-domestic"]);
    expect(internal.tools.map((t) => t.name)).toContain("get_course_thing");
  });
  it("answers data_unavailable from a vertical that failed to start", async () => {
    markVerticalFailed("courses-domestic", "tables missing");
    try {
      const t = routeSet(all, ["courses-domestic"]).tools.find(
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
