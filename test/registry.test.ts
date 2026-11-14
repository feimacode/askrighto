import { afterEach, describe, expect, it } from "vitest";
import { clearDataSets, listDataSets, oldestRefresh, registerDataSet, staleWarnings } from "../src/core/registry.js";

const base = {
  title: "Energy plans",
  publisher: "AER",
  source: { name: "AER", url: "https://example.org", licence: "CDR rule 2.6" },
  coverage: "Test",
  maxAgeHours: 48,
};

afterEach(() => clearDataSets());

describe("data source registry", () => {
  it("lists registered datasets and rejects duplicates", () => {
    registerDataSet({ ...base, id: "energy", refreshedAt: () => new Date() });
    expect(listDataSets().map((d) => d.id)).toEqual(["energy"]);
    expect(() => registerDataSet({ ...base, id: "energy", refreshedAt: () => new Date() })).toThrow(/already registered/);
  });

  it("warns when a dataset is older than its allowed age", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    registerDataSet({ ...base, id: "energy", refreshedAt: () => new Date("2026-11-10T12:00:00Z") });
    const w = staleWarnings(["energy"], now);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("2026-11-10T12:00:00.000Z");
  });

  it("stays quiet for fresh data and warns for never-loaded data", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    registerDataSet({ ...base, id: "fresh", refreshedAt: () => new Date("2026-11-13T00:00:00Z") });
    registerDataSet({ ...base, id: "never", title: "Never loaded", refreshedAt: () => undefined });
    expect(staleWarnings(["fresh"], now)).toEqual([]);
    expect(staleWarnings(["never"], now)[0]).toContain("has not been loaded");
  });

  it("gives the oldest refresh time, or none if any dataset is unloaded", () => {
    registerDataSet({ ...base, id: "a", refreshedAt: () => new Date("2026-11-12T00:00:00Z") });
    registerDataSet({ ...base, id: "b", refreshedAt: () => new Date("2026-11-13T00:00:00Z") });
    expect(oldestRefresh(["a", "b"])?.toISOString()).toBe("2026-11-12T00:00:00.000Z");
    registerDataSet({ ...base, id: "c", refreshedAt: () => undefined });
    expect(oldestRefresh(["a", "c"])).toBeUndefined();
  });
});
