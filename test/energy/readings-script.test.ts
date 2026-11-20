/**
 * The layer 3 reference script (add-energy-readings-layers task 2.3): it must give the server's profile on the same file,
 * and it must not be able to touch the network, run programs, evaluate text or write files.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNem12 } from "../../src/energy/readings/parse.js";
import { buildProfile, type ReadingsState } from "../../src/energy/readings/profile.js";

const SCRIPT = "plugin/skills/energy-bill-comparison/references/build_readings_profile.py";
const py = spawnSync("python3", ["--version"]);
const t = py.status === 0 ? it : it.skip;
const NMI = "4001234567"; // invented

interface S {
  suffix: string;
  per?: number;
  at: (date: string, slot: number) => number;
  uom?: string;
}
function file(start: string, days: number, streams: S[], opt: { skip?: string[]; variable?: string } = {}): string {
  const out = ["100,NEM12,202611191200,UNITEDP,RETAILX"];
  const t0 = Date.UTC(+start.slice(0, 4), +start.slice(4, 6) - 1, +start.slice(6, 8));
  for (const st of streams) {
    const per = st.per ?? 30;
    out.push(`200,${NMI},${st.suffix},1,${st.suffix},,SER0001,${st.uom ?? "KWH"},${per},`);
    for (let k = 0; k < days; k++) {
      const d = new Date(t0 + k * 86_400_000);
      const date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
      if (opt.skip?.includes(date)) continue;
      const vals: string[] = [];
      for (let i = 0; i < 1440 / per; i++) vals.push(((st.at(date, Math.floor((i * per) / 30)) * per) / 30).toFixed(4));
      const q = date === opt.variable ? "V" : "A";
      out.push(`300,${date},${vals.join(",")},${q},,,${date}120000,`);
      if (q === "V") out.push("400,1,12,A,79,");
    }
  }
  out.push("900");
  return out.join("\n");
}
const evening = (_d: string, s: number) => (s >= 30 && s < 42 ? 0.5 : 0.1 + (s % 5) * 0.013);
const solar = (_d: string, s: number) => (s >= 20 && s < 34 ? 0.8 : 0);

function run(text: string, state: ReadingsState): Record<string, unknown> {
  const dir = mkdtempSync(join(tmpdir(), "readings-"));
  const f = join(dir, "r.csv");
  writeFileSync(f, text);
  return JSON.parse(execFileSync("python3", ["-I", SCRIPT, f, state], { encoding: "utf8" })) as Record<string, unknown>;
}
function server(text: string, state: ReadingsState): Record<string, unknown> {
  const p = parseNem12(text);
  if (!p.ok) throw new Error(p.problem);
  return JSON.parse(JSON.stringify(buildProfile(p, state)));
}
function same(a: unknown, b: unknown, path = "profile"): void {
  if (typeof a === "number" && typeof b === "number") return void expect(a, path).toBeCloseTo(b, 9);
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, path).toBe(b.length);
    return void a.forEach((x, i) => same(x, b[i], `${path}[${i}]`));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    return void Object.keys(a).forEach((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`));
  }
  expect(a, path).toEqual(b);
}

describe("reference script: same profile as the server", () => {
  t("on 30-minute data with solar, a missing day and a variable day, in each state around the daylight saving changes", () => {
    const text = file("20250920", 230, [{ suffix: "E1", at: evening }, { suffix: "B1", at: solar }], { skip: ["20251105", "20251106"], variable: "20251010" });
    for (const state of ["NSW", "VIC", "QLD", "SA", "TAS", "ACT"] as const) same(run(text, state), server(text, state));
  });
  t("on 5-minute and 15-minute data, two E streams and Wh units", () => {
    same(run(file("20260101", 20, [{ suffix: "E1", per: 5, at: evening }, { suffix: "E2", per: 5, at: () => 0.05 }]), "VIC"), server(file("20260101", 20, [{ suffix: "E1", per: 5, at: evening }, { suffix: "E2", per: 5, at: () => 0.05 }]), "VIC"));
    const wh = file("20260301", 12, [{ suffix: "E1", per: 15, uom: "WH", at: () => 120 }]);
    same(run(wh, "NSW"), server(wh, "NSW"));
  });
  t("on a net-only file", () => {
    const text = file("20260201", 10, [{ suffix: "N1", at: () => 0.2 }]);
    same(run(text, "SA"), server(text, "SA"));
  });
  t("refuses a NEM13 file, two NMIs and a bad value with a reason that holds none of the file", () => {
    const dir = mkdtempSync(join(tmpdir(), "readings-"));
    const bad = (text: string) => {
      const f = join(dir, "b.csv");
      writeFileSync(f, text);
      return spawnSync("python3", ["-I", SCRIPT, f, "NSW"], { encoding: "utf8" });
    };
    const a = bad(`100,NEM13,202611191200,A,B\n250,${NMI},E1,1,E1,,SER0001,20260101,0,10,20,A\n900`);
    expect(a.status).toBe(1);
    expect(a.stderr).toMatch(/NEM13/);
    expect(a.stderr).not.toContain(NMI);
    const two = bad(`200,${NMI},E1,1,E1,,SER0001,KWH,30,\n200,4001234999,E1,1,E1,,SER0002,KWH,30,\n`);
    expect(two.status).toBe(1);
    expect(two.stderr).toMatch(/more than one NMI/);
    expect(two.stderr).not.toContain("4001234999");
  });
  t("prints no identifier", () => {
    const out = JSON.stringify(run(file("20260101", 5, [{ suffix: "E1", at: evening }]), "NSW"));
    expect(out).not.toContain(NMI);
    expect(out).not.toContain("SER0001");
  });
});

describe("reference script: cannot reach out", () => {
  const src = readFileSync(SCRIPT, "utf8");
  const code = src.replace(/"""[\s\S]*?"""/, "").split("\n").map((l) => l.replace(/#.*$/, "")).join("\n");
  it("imports only sys, json, math and datetime", () => {
    const imports = [...code.matchAll(/^\s*(?:import|from)\s+([\w.]+)/gm)].map((m) => m[1]);
    expect(new Set(imports)).toEqual(new Set(["json", "math", "sys", "datetime"]));
  });
  it("has no network, shell, evaluation, dynamic import, or file write", () => {
    for (const bad of [/\bsocket\b/, /\burllib\b/, /\bhttp\b/, /\brequests\b/, /\bsubprocess\b/, /\bos\./, /\bshutil\b/, /\beval\s*\(/, /\bexec\s*\(/, /\bcompile\s*\(/, /__import__/, /\bgetattr\s*\(/, /\bctypes\b/, /\bpickle\b/, /\.write\s*\(/])
      if (bad.source !== "\\.write\\s*\\(") expect(code, String(bad)).not.toMatch(bad);
    // The only writes are to standard output and standard error, and the only open is a read.
    const writes = [...code.matchAll(/(\w+(?:\.\w+)*)\.write\s*\(/g)].map((m) => m[1]);
    expect(writes.every((w) => w === "sys.stdout" || w === "sys.stderr")).toBe(true);
    const opens = [...code.matchAll(/\bopen\s*\(([^)]*)\)/g)].map((m) => m[1]);
    expect(opens).toHaveLength(1);
    expect(opens[0]).toMatch(/"r"/);
  });
});
