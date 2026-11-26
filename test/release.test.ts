import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
// @ts-expect-error plain .mjs script, no types
import * as bump from "../scripts/bump-version.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const b = bump as {
  VERSION_PATTERN: RegExp;
  readVersions: () => { file: string; version: string }[];
  changelogSection: (t: string, v: string) => string | null;
  changelogProblems: (t: string, v: string) => string[];
};

describe("release process", () => {
  it("accepts release and pre-release versions only", () => {
    for (const v of ["0.1.0", "1.2.3", "0.2.0-beta.1", "0.2.0-alpha.3"])
      expect(b.VERSION_PATTERN.test(v), v).toBe(true);
    for (const v of ["v0.1.0", "0.1", "0.2.0-rc.1", "0.2.0-beta"])
      expect(b.VERSION_PATTERN.test(v), v).toBe(false);
  });

  it("keeps one version in every file a release checks", () => {
    const versions = new Set(b.readVersions().map((f) => f.version));
    expect(versions.size).toBe(1);
  });

  it("has a changelog section with its listing impact for the current version", () => {
    const version = b.readVersions()[0]!.version;
    const text = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    expect(b.changelogProblems(text, version)).toEqual([]);
  });

  it("reads one section and refuses one without a listing impact", () => {
    const text =
      "# Changelog\n\n## [0.2.0]\n\n- new\n\n## [0.1.0]\n\n**Listing impact:** none\n";
    expect(b.changelogSection(text, "0.2.0")).toBe("## [0.2.0]\n\n- new");
    expect(b.changelogProblems(text, "0.2.0")[0]).toMatch(/Listing impact/);
    expect(b.changelogProblems(text, "0.1.0")).toEqual([]);
    expect(b.changelogProblems(text, "0.3.0")[0]).toMatch(/no "## \[0.3.0\]"/);
  });

  it("names exactly the energy tools as public", () => {
    const config = JSON.parse(
      readFileSync(join(ROOT, "plugin/askrighto.config.json"), "utf8"),
    );
    expect(config.publicTools.length).toBeGreaterThan(0);
    for (const t of config.publicTools as string[])
      expect(t).not.toMatch(/course|health|home_loan|vce|career/);
  });
});
