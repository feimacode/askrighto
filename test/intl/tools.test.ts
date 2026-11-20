import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setIntlRuntime } from "../../src/intl/index.js";
import { INTL_NOTICE } from "../../src/intl/notice.js";
import { bannedIn } from "../../src/courses/notice.js";
import { metricsText, resetMetrics } from "../../src/core/metrics.js";
import { call, connectIntl, installIntl } from "./helpers.js";

beforeEach(() => installIntl());
afterEach(() => {
  setIntlRuntime(undefined);
  vi.unstubAllEnvs();
});

describe("international tools", () => {
  it("are listed read-only on the internal route and absent from a public one", async () => {
    const internal = (await (await connectIntl()).listTools()).tools;
    for (const n of [
      "search_international_courses",
      "get_international_course",
      "compare_international_courses",
      "get_international_entry_checklist",
    ])
      expect(internal.map((t) => t.name)).toContain(n);
    for (const t of internal) expect(t.annotations?.readOnlyHint).toBe(true);
    const pub = (
      await (await connectIntl(["energy", "courses-domestic"], "public")).listTools()
    ).tools.map((t) => t.name);
    expect(pub.some((n) => n.includes("intl"))).toBe(false);
  });

  it("finds a diploma and says its sector is not stated when the register gives no code", async () => {
    const c = await connectIntl();
    const { data } = await call(c, "search_international_courses", {
      level: "diploma",
    });
    expect(data.found).toBe(true);
    expect(data.data.courses).toHaveLength(1);
    expect(data.data.courses[0].cricosCode).toBe("000007G");
    const none = await call(c, "search_international_courses", {
      sector: "vet",
    });
    expect(none.data.found).toBe(false);
  });

  it("filters by level and location, with fee labels, source date and attribution", async () => {
    const c = await connectIntl();
    const { data, text } = await call(c, "search_international_courses", {
      level: "master",
      state: "NSW",
    });
    expect(data.found).toBe(true);
    expect(
      data.data.courses.map((x: { cricosCode: string }) => x.cricosCode),
    ).toEqual(["000002B"]);
    expect(data.data.courses[0].feeNote).toMatch(
      /Indicative, as published in CRICOS, file dated 2026-02-02/,
    );
    expect(data.asOf).toMatch(/^2026-02-02/);
    expect(data.source.attribution).toMatch(/CC BY 2\.5 AU/);
    expect(text).toContain(INTL_NOTICE);
    expect(bannedIn(text)).toEqual([]);
  });

  it("leaves expired courses out of search and shows them with a label on lookup", async () => {
    const c = await connectIntl();
    const s = await call(c, "search_international_courses", { query: "nursing" });
    expect(s.data.found).toBe(false);
    const g = await call(c, "get_international_course", { cricosCode: "000005E" });
    expect(g.data.found).toBe(true);
    expect(g.data.data.expired).toBe(true);
    expect(g.data.warnings?.join(" ")).toMatch(/expired/);
  });

  it("does not count a course with no published fee as under a fee limit, and says how many", async () => {
    const c = await connectIntl();
    const { data } = await call(c, "search_international_courses", {
      level: "bachelor",
      maxTotalFee: 125000,
    });
    expect(
      data.data.courses.map((x: { cricosCode: string }) => x.cricosCode),
    ).toEqual(["000006F"]);
    expect(data.data.matchesWithoutPublishedFee).toBe(1);
  });

  it("shows no fee as 'not published' and never estimates one", async () => {
    const c = await connectIntl();
    const { data, text } = await call(c, "get_international_course", {
      cricosCode: "000003C",
    });
    expect(data.data.tuitionFeeTotal).toBeUndefined();
    expect(data.data.feeNote).toBe("Not published in CRICOS");
    expect(text).toMatch(/not published/i);
  });

  it("shows a yearly fee only when fee and duration are both published, labelled as calculated", async () => {
    const c = await connectIntl();
    const both = await call(c, "get_international_course", { cricosCode: "000002B" });
    expect(both.data.data.yearlyFee).toBe(48000);
    expect(both.data.data.yearlyFeeNote).toBe(
      "calculated: total fee divided by duration",
    );
    const noDuration = await call(c, "get_international_course", {
      cricosCode: "000006F",
    });
    expect(noDuration.data.data.yearlyFee).toBeUndefined();
  });

  it("compares two to five courses and refuses one", async () => {
    const c = await connectIntl();
    const ok = await call(c, "compare_international_courses", {
      cricosCodes: ["000001A", "000002B"],
    });
    expect(ok.data.found).toBe(true);
    expect(ok.text).toMatch(/Yearly fee is calculated/);
    const one = await call(c, "compare_international_courses", {
      cricosCodes: ["000001A"],
    });
    expect(one.data.reason).toBe("needs_input");
    const bad = await call(c, "compare_international_courses", {
      cricosCodes: ["000001A", "NOPE"],
    });
    expect(bad.data.reason).toBe("not_in_dataset");
  });

  it("gives a checklist and link, with no English score, entry requirement or visa advice", async () => {
    const c = await connectIntl();
    const { data, text } = await call(c, "get_international_entry_checklist", {
      cricosCode: "000001A",
    });
    expect(data.data.providerWebsite).toBe(
      "https://www.testu.edu.au/international",
    );
    expect(data.data.readingChecklist.join(" ")).toMatch(
      /English language requirement/,
    );
    expect(text).toMatch(/Department of Home Affairs/);
    expect(text).not.toMatch(/IELTS|TOEFL|\b6\.5\b/);
    const noSite = await call(c, "get_international_entry_checklist", {
      cricosCode: "000004D",
    });
    expect(noSite.data.data.providerWebsite).toBeUndefined();
  });

  it("answers data_unavailable with no runtime, in production with the entry not cleared, and counts outcomes only", async () => {
    resetMetrics();
    const c = await connectIntl();
    await call(c, "search_international_courses", { level: "master" });
    expect(metricsText()).toMatch(
      /tool="search_international_courses",outcome="results"/,
    );
    expect(metricsText()).not.toMatch(/master/);
    setIntlRuntime(undefined);
    const gone = await call(c, "get_international_course", { cricosCode: "000001A" });
    expect(gone.data.reason).toBe("data_unavailable");
  });

  it("returns a not-found for an unknown code", async () => {
    const c = await connectIntl();
    const { data } = await call(c, "get_international_course", { cricosCode: "ZZZ" });
    expect(data).toMatchObject({ found: false, reason: "not_in_dataset" });
  });
});
