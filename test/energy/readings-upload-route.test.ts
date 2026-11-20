/**
 * The signed upload address for large readings files (layer 2 of add-energy-readings-layers): token rules, the PUT route,
 * the tool that mints the address, and that nothing from a file is kept or logged.
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MAX_READINGS_CHARS } from "../../src/energy/readings/parse.js";
import { decodeProfile } from "../../src/energy/readings/profile.js";
import { setProfileKeys } from "../../src/energy/readings/sign.js";
import { checkUploadToken, mintUploadToken, UPLOAD_TTL_SECONDS } from "../../src/energy/readings/upload.js";
import { maskInternalPath } from "../../src/server/internal.js";
import { handleReadingsUpload } from "../../src/server/readings-upload.js";
import { allTools } from "../../src/tools/index.js";

const KEY = { id: "t1", secret: "x".repeat(40) };
const NMI = "4001234567"; // invented

/** `days` days of 5-minute data, one E1 stream: every interval 0.01 kWh, so a day is 2.88 kWh. */
function bigFile(days: number, start = Date.UTC(2026, 0, 1)): string {
  const out = ["100,NEM12,202611191200,UNITEDP,RETAILX", `200,${NMI},E1,1,E1,,SER0001,KWH,5,`];
  for (let k = 0; k < days; k++) {
    const d = new Date(start + k * 86_400_000);
    const date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    out.push(`300,${date},${Array(288).fill("0.010").join(",")},A,,,${date}120000,`);
  }
  out.push("900");
  return out.join("\n");
}

describe("upload token", () => {
  it("is valid for five minutes, carries the postcode and the size cap, and rejects change or expiry", () => {
    setProfileKeys({ current: KEY });
    const now = new Date("2026-11-20T00:00:00Z");
    const t = mintUploadToken("3000", now, 1_000_000);
    expect(t.url).toMatch(/\/readings-upload\//);
    expect(checkUploadToken(t.token, now)).toEqual({ ok: true, postcode: "3000", max: 1_000_000 });
    expect(checkUploadToken(t.token, new Date(now.getTime() + (UPLOAD_TTL_SECONDS - 1) * 1000)).ok).toBe(true);
    expect(checkUploadToken(t.token, new Date(now.getTime() + (UPLOAD_TTL_SECONDS + 1) * 1000)).ok).toBe(false);
    // Changing the payload (a bigger cap or another postcode) breaks the signature.
    const [p, sig] = t.token.split(".") as [string, string];
    const payload = Buffer.from(p, "base64url").toString().replace("1000000", "9000000");
    expect(checkUploadToken(`${Buffer.from(payload).toString("base64url")}.${sig}`, now).ok).toBe(false);
    expect(checkUploadToken("garbage", now).ok).toBe(false);
  });

  it("is refused under another key, and accepted under the previous key after a rotation", () => {
    setProfileKeys({ current: KEY });
    const now = new Date();
    const t = mintUploadToken("3000", now);
    setProfileKeys({ current: { id: "t2", secret: "y".repeat(40) } });
    expect(checkUploadToken(t.token, now).ok).toBe(false);
    setProfileKeys({ current: { id: "t2", secret: "y".repeat(40) }, previous: KEY });
    expect(checkUploadToken(t.token, now).ok).toBe(true);
    setProfileKeys({ current: KEY });
  });

  it("masks the token in the access log", () => {
    expect(maskInternalPath("/readings-upload/abc.def")).toBe("/readings-upload/***");
  });
});

describe("PUT /readings-upload/<token>", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    setProfileKeys({ current: KEY });
    const app = express();
    app.use(express.json({ limit: "256kb" }));
    app.all("/readings-upload/:token", handleReadingsUpload);
    await new Promise<void>((r) => {
      server = app.listen(0, "127.0.0.1", () => r());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((r) => server.close(r));
  });
  const put = (token: string, body: string, type = "text/csv") => fetch(`${base}/readings-upload/${token}`, { method: "PUT", headers: { "Content-Type": type }, body });

  it("turns a file too long for a tool call into a signed profile, with no identifier in the answer", async () => {
    const text = bigFile(200);
    expect(text.length).toBeGreaterThan(MAX_READINGS_CHARS);
    const t = mintUploadToken("3000");
    const r = await put(t.token, text);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const body = (await r.json()) as { profile: string; summary: Record<string, unknown> };
    const d = decodeProfile(body.profile);
    expect(d.ok && d.verified).toBe(true);
    expect(d.ok && d.profile.daysPresent).toBe(200);
    expect(body.summary.annualKwh).toBe(Math.round((200 * 2.88 * 365) / 200));
    expect(body.summary).not.toHaveProperty("profile");
    expect(JSON.stringify(body)).not.toContain(NMI);
    expect(JSON.stringify(body)).not.toContain("SER0001");
  });

  it("refuses a bad or expired address with one fixed answer, a file over the cap, and a JSON body", async () => {
    expect((await put("nope", "x")).status).toBe(401);
    const small = mintUploadToken("3000", new Date(), 50_000);
    expect((await put(small.token, bigFile(60))).status).toBe(413);
    const ok = mintUploadToken("3000");
    expect((await put(ok.token, "{}", "application/json")).status).toBe(415);
    const expired = mintUploadToken("3000", new Date(Date.now() - 10 * 60_000));
    const r = await put(expired.token, bigFile(2));
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: string }).error).toMatch(/not valid or has expired/);
    expect((await fetch(`${base}/readings-upload/${ok.token}`, { method: "GET" })).status).toBe(405);
  });

  it("answers a file it cannot read with a plain reason that repeats none of the file, and writes nothing to the log", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await put(mintUploadToken("3000").token, `100,NEM13,202611191200,A,B\n250,${NMI},E1,1,E1,,SER0001,20260101,0,10,20,A\n900`);
    expect(r.status).toBe(422);
    const msg = ((await r.json()) as { error: string }).error;
    expect(msg).toMatch(/could not be read/);
    expect(msg).not.toContain(NMI);
    expect(err).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    err.mockRestore();
    log.mockRestore();
  });

  it("refuses a postcode outside the market", async () => {
    const r = await put(mintUploadToken("6000").token, bigFile(2));
    expect(r.status).toBe(422);
  });
});

describe("get_readings_upload_link", () => {
  const tool = allTools.find((t) => t.name === "get_readings_upload_link")!;
  it("is a registered tool taking only a postcode", () => {
    expect(tool).toBeTruthy();
    expect(Object.keys((tool.inputSchema as { shape: object }).shape)).toEqual(["postcode"]);
  });
  it("returns an address, the five minute life and the steps, and refuses WA", async () => {
    setProfileKeys({ current: KEY });
    const r = (await tool.handler({ postcode: "3000" } as never)) as { found: boolean; data: { uploadUrl: string; expiresInSeconds: number; steps: string[] } };
    expect(r.found).toBe(true);
    expect(r.data.uploadUrl).toMatch(/\/readings-upload\/[\w-]+\.[\w-]+\.[\w-]+/);
    expect(r.data.expiresInSeconds).toBe(300);
    expect(r.data.steps.join(" ")).toMatch(/readingsProfile/);
    const wa = (await tool.handler({ postcode: "6000" } as never)) as { found: boolean; reason?: string };
    expect(wa).toMatchObject({ found: false, reason: "outside_coverage" });
  });
});

describe("a file sent in part", () => {
  it("warns the host that only a few days arrived and that a sample must not stand for the file", async () => {
    const { parseNem12 } = await import("../../src/energy/readings/parse.js");
    const { buildProfile } = await import("../../src/energy/readings/profile.js");
    const { summaryOf } = await import("../../src/tools/summarise-interval-readings.js");
    const p = parseNem12(bigFile(2));
    if (!p.ok) throw new Error("parse");
    const s = summaryOf(buildProfile(p, "VIC"), "3128");
    expect(s.notes.join(" ")).toMatch(/only 2 days/);
    expect(s.notes.join(" ")).toMatch(/only part of it was sent: do not use this result/);
    const tool = allTools.find((t) => t.name === "summarise_interval_readings")!;
    expect(tool.description).toMatch(/never a sample/);
  });
});
