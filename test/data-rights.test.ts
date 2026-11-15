import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RIGHTS } from "../src/core/rights.js";
import { ALL_VERTICALS } from "../src/server/route.js";
import { COURSES_DATASET_IDS } from "./courses/helpers.js";

describe("data rights register", () => {
  it("docs/data-rights.md has a section for every dataset id and nothing extra", () => {
    const md = readFileSync("docs/data-rights.md", "utf8");
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]).sort();
    expect(headings).toEqual(RIGHTS.map((e) => e.datasetId).sort());
  });
  it("every dataset the courses vertical registers has an entry", () => {
    expect(ALL_VERTICALS.length).toBeGreaterThan(1);
    for (const id of COURSES_DATASET_IDS)
      expect(RIGHTS.map((e) => e.datasetId)).toContain(id);
  });
  it("no data file of a pending, refused or withdrawn dataset is tracked by git", () => {
    const tracked = execSync("git ls-files data", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    const blocked = RIGHTS.filter((e) =>
      ["pending", "refused", "withdrawn"].includes(e.status),
    );
    for (const e of blocked) {
      for (const g of e.dataGlobs ?? []) {
        const re = new RegExp(
          "^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"),
        );
        expect(
          tracked.filter((f) => re.test(f)),
          `${e.datasetId}: ${g}`,
        ).toEqual([]);
      }
    }
    expect(tracked.some((f) => f.startsWith("data/local/"))).toBe(false);
    expect(tracked.some((f) => f.endsWith(".csv"))).toBe(false);
  });
});
