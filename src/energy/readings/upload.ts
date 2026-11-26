/**
 * The signed upload address for interval readings files too large to pass through a tool call (layer 2 of the readings
 * ladder, add-energy-readings-layers). Stateless: the address carries an expiry, a size cap and the postcode, signed with
 * the profile key, so nothing is stored to check it and nothing from the file is kept. A short life, the cap and the rate
 * limit bound abuse (no single-use record is kept, which would need shared state).
 */
import { PUBLIC_URL } from "../../config.js";
import { stateOfPostcode } from "../benchmarks/state.js";
import { parseNem12 } from "./parse.js";
import { buildProfile, encodeProfile } from "./profile.js";
import { signText, verifyText } from "./sign.js";

export const UPLOAD_TTL_SECONDS = 300;
export const DEFAULT_UPLOAD_MAX = 5_000_000;
const PURPOSE = "readings-upload";

export function uploadMax(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.ASKRIGHTO_UPLOAD_MAX);
  return Number.isFinite(n) && n >= 50_000 && n <= 50_000_000 ? Math.floor(n) : DEFAULT_UPLOAD_MAX;
}

/** An address valid for five minutes for one file of up to `max` bytes, for a property in `postcode`. */
export function mintUploadToken(postcode: string, now: Date = new Date(), max: number = uploadMax()): { token: string; url: string; expiresAt: string; maxBytes: number } {
  const exp = Math.floor(now.getTime() / 1000) + UPLOAD_TTL_SECONDS;
  const payload = `${exp}.${max}.${postcode}`;
  const token = `${Buffer.from(payload).toString("base64url")}.${signText(PURPOSE, payload)}`;
  return { token, url: `${PUBLIC_URL.replace(/\/$/, "")}/readings-upload/${token}`, expiresAt: new Date(exp * 1000).toISOString(), maxBytes: max };
}

export type TokenCheck = { ok: true; postcode: string; max: number } | { ok: false };

export function checkUploadToken(token: string, now: Date = new Date()): TokenCheck {
  const i = token.indexOf(".");
  if (i < 1) return { ok: false };
  let payload: string;
  try {
    payload = Buffer.from(token.slice(0, i), "base64url").toString("utf8");
  } catch {
    return { ok: false };
  }
  if (!verifyText(PURPOSE, payload, token.slice(i + 1))) return { ok: false };
  const m = /^(\d+)\.(\d+)\.(\d{4})$/.exec(payload);
  if (!m || Number(m[1]) * 1000 < now.getTime()) return { ok: false };
  return { ok: true, postcode: m[3]!, max: Number(m[2]) };
}

export type UploadResult = { ok: true; profile: string; postcode: string; state: string; daysPresent: number; period: { from: string; to: string } } | { ok: false; problem: string };

/** Reads the file text into a signed profile. The text is not kept and no identifier from it is returned. */
export function profileFromUpload(text: string, postcode: string, maxChars: number): UploadResult {
  const state = stateOfPostcode(postcode);
  if (!state || state === "WA" || state === "NT") return { ok: false, problem: "the postcode is outside the National Electricity Market places Ask Righto covers" };
  const parsed = parseNem12(text, maxChars);
  if (!("streamsUsed" in parsed)) return { ok: false, problem: parsed.problem };
  const p = buildProfile(parsed, state);
  return { ok: true, profile: encodeProfile(p), postcode, state, daysPresent: p.daysPresent, period: { from: p.from, to: p.to } };
}
