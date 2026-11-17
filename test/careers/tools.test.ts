import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCareerRuntime } from "../../src/careers/index.js";
import { bannedInCareer } from "../../src/careers/notice.js";
import { CAREER_TOOLS } from "../../src/tools/career-tools.js";
import { call as rawCall, connectCareers, installCareers } from "./helpers.js";

const call = async (...a: Parameters<typeof rawCall>) => (await rawCall(...a)).data;

beforeEach(async () => installCareers());
afterEach(() => {
  setCareerRuntime(undefined);
  vi.restoreAllMocks();
});

describe("career outcomes tools", () => {
  it("are read-only, on the internal route only, with no free-text personal input", async () => {
    const internal = (await (await connectCareers()).listTools()).tools;
    for (const t of CAREER_TOOLS) expect(internal.map((x) => x.name)).toContain(t.name);
    for (const t of internal) expect(t.annotations?.readOnlyHint).toBe(true);
    const pub = (await (await connectCareers(["energy"], "public")).listTools()).tools.map((t) => t.name);
    expect(pub.some((n) => n.includes("occupation"))).toBe(false);
  });

  it("finds unit groups by name and leaves out nfd and group rows", async () => {
    const r = await call(await connectCareers(), "find_occupations", { query: "chief executives" });
    expect(r.found).toBe(true);
    expect(r.data.occupations.map((o: { code: string }) => o.code)).toEqual(["1111"]);
    expect(r.source.attribution).toMatch(/Commonwealth of Australia/);
    expect(r.asOf).toBe("2025-11-06T00:00:00.000Z");
  });

  it("returns not-found with the official link when nothing matches", async () => {
    const r = await call(await connectCareers(), "find_occupations", { query: "astronaut" });
    expect(r.found).toBe(false);
    expect(r.reason).toBe("not_in_dataset");
    expect((r as unknown as { details: { officialUrl: string } }).details.officialUrl).toMatch(/jobsandskills\.gov\.au/);
  });

  it("returns the published outlook with source, periods and the skill level as a level of study", async () => {
    const r = await call(await connectCareers(), "get_occupation_outlook", { code: "2411" });
    expect(r.found).toBe(true);
    expect(r.data.employmentThousands).toEqual([
      { period: "May 2025", thousands: 300.25 },
      { period: "May 2030", thousands: 330 },
      { period: "May 2035", thousands: 360.75 },
    ]);
    expect(r.data.change10Years).toEqual({ thousands: 60.5, percent: 20.15 });
    expect(r.data.skillLevelQualification).toBe("Bachelor degree or higher");
    expect(r.source.licence).toBe("CC BY 4.0");
    expect(Object.keys(r.data).join(" ")).not.toMatch(/salary|wage|earnings|pay/i);
  });

  it("says a figure is not published instead of estimating it", async () => {
    const r = await call(await connectCareers(), "get_occupation_outlook", { code: "8996" });
    expect(r.found).toBe(true);
    expect(r.data.employmentThousands[0]).toEqual({ period: "May 2025" });
    expect(r.data.change5Years).toBeUndefined();
  });

  it("answers not-found for an unknown code and data_unavailable with no data", async () => {
    const c = await connectCareers();
    expect((await call(c, "get_occupation_outlook", { code: "9999" })).reason).toBe("not_in_dataset");
    setCareerRuntime(undefined);
    expect((await call(c, "get_occupation_outlook", { code: "2411" })).reason).toBe("data_unavailable");
  });

  it("builds its Inkview components without validation errors and never steers a decision", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = await connectCareers();
    const out = await c.callTool({ name: "get_occupation_outlook", arguments: { code: "2411" } });
    await c.callTool({ name: "find_occupations", arguments: { query: "nurse" } });
    expect(err.mock.calls.flat().join(" ")).not.toMatch(/Inkview component skipped/);
    const text = (out.content as { text: string }[])[0]!.text;
    expect(bannedInCareer(text)).toEqual([]);
    for (const t of CAREER_TOOLS) expect(bannedInCareer(t.description)).toEqual([]);
  });
});
