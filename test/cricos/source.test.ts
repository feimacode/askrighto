import { describe, expect, it } from "vitest";
import { checkGuards } from "../../src/cricos/guards.js";
import {
  allowedHost,
  downloadCricos,
  findCricosSource,
  MAX_BODY_BYTES,
} from "../../src/cricos/source.js";
import { fakeFetch } from "./helpers.js";

describe("CRICOS source lookup", () => {
  it("finds the three resources and takes the file date from the Courses resource", async () => {
    const s = await findCricosSource(fakeFetch({ modified: "2026-11-02T08:03:13.668" }));
    expect(s.sourceDate).toBe("2026-11-02");
    expect(Object.keys(s.resources).sort()).toEqual(["courseLocations", "courses", "institutions"]);
    expect(s.fingerprint).toContain("id-courses@2026-11-02");
    const again = await findCricosSource(fakeFetch({ modified: "2026-12-01T00:00:00" }));
    expect(again.fingerprint).not.toBe(s.fingerprint);
  });
  it("downloads the bodies and hashes them", async () => {
    const f = fakeFetch();
    const files = await downloadCricos(f, await findCricosSource(f));
    expect(files.courses).toContain("CRICOS Course Code");
    expect(files.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const other = fakeFetch({ courses: files.courses + "\n" });
    const o = await downloadCricos(other, await findCricosSource(other));
    expect(o.contentHash).not.toBe(files.contentHash);
  });
  it("refuses a resource on another host", async () => {
    await expect(
      findCricosSource(fakeFetch({ urlFor: { courses: "https://evil.example/courses.csv" } })),
    ).rejects.toThrow(/not data\.gov\.au/);
    await expect(
      findCricosSource(fakeFetch({ urlFor: { courses: "http://data.gov.au/courses.csv" } })),
    ).rejects.toThrow(/not data\.gov\.au/);
  });
  it("refuses a redirect to another host", async () => {
    const f = fakeFetch({ redirectTo: "https://evil.example/x.csv" });
    const src = await findCricosSource(f);
    await expect(downloadCricos(f, src)).rejects.toThrow(/redirected to evil\.example/);
  });
  it("refuses a dataset missing a resource", async () => {
    await expect(findCricosSource(fakeFetch({ omit: "institutions" }))).rejects.toThrow(
      /no resource named "CRICOS Institutions\.csv"/,
    );
  });
  it("refuses an oversize body", async () => {
    const f = fakeFetch({ courses: "x".repeat(MAX_BODY_BYTES + 1) });
    await expect(downloadCricos(f, await findCricosSource(f))).rejects.toThrow(/larger than/);
  });
  it("allows only https on data.gov.au", () => {
    expect(allowedHost("https://data.gov.au/a")).toBe(true);
    expect(allowedHost("https://cdn.data.gov.au/a")).toBe(true);
    expect(allowedHost("https://data.gov.au.evil.com/a")).toBe(false);
    expect(allowedHost("http://data.gov.au/a")).toBe(false);
  });
});

describe("CRICOS guards", () => {
  const ok = { problems: [], newIntlKept: 23000, prevIntlKept: 23400, newDomesticCourses: 3700, prevDomesticCourses: 3750, newSourceDate: "2026-11-02", prevSourceDate: "2026-10-01" };
  it("passes a normal change", () => expect(checkGuards(ok).ok).toBe(true));
  it("stops a missing column even when forced", () => {
    const r = checkGuards({ ...ok, problems: ["missing course code"], force: true });
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/missing course code/);
  });
  it("stops an international drop over 20 percent, unless forced", () => {
    const g = { ...ok, newIntlKept: 15000 };
    expect(checkGuards(g).failures.join()).toMatch(/international courses fell/);
    const f = checkGuards({ ...g, force: true });
    expect(f.ok).toBe(true);
    expect(f.overridden.length).toBe(1);
  });
  it("stops a domestic drop over 20 percent", () =>
    expect(checkGuards({ ...ok, newDomesticCourses: 2000 }).failures.join()).toMatch(/domestic courses fell/));
  it("stops a floor breach and an older file", () => {
    expect(checkGuards({ ...ok, newIntlKept: 500, prevIntlKept: undefined }).failures.join()).toMatch(/floor/);
    expect(checkGuards({ ...ok, newSourceDate: "2026-09-01" }).failures.join()).toMatch(/older than/);
  });
  it("allows the first load", () =>
    expect(checkGuards({ problems: [], newIntlKept: 23000, newDomesticCourses: 3700, newSourceDate: "2026-11-02" }).ok).toBe(true));
});

describe("scheduled refresh", () => {
  it("is off unless asked for, and needs a database", async () => {
    const { startCricosSchedule } = await import("../../src/cricos/index.js");
    expect(startCricosSchedule({ DATABASE_URL: "postgres://x/y" } as never)).toBeUndefined();
    expect(startCricosSchedule({ ASKRIGHTO_CRICOS_REFRESH: "on" } as never)).toBeUndefined();
    expect(startCricosSchedule({ ASKRIGHTO_CRICOS_REFRESH: "off", DATABASE_URL: "postgres://x/y" } as never)).toBeUndefined();
  });
});
