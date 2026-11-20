/**
 * Provenance for readings profiles. A profile the server built carries an HMAC signature so a later call can tell
 * it from one the host rewrote or built itself. Signing is stateless: nothing is stored, and the key never leaves
 * the server. A profile with no valid signature is still usable after the usual shape and totals checks, but
 * estimates from it are labelled as not verified.
 *
 * Keys: `ASKRIGHTO_PROFILE_KEY` is "<id>:<secret>" (secret at least 32 characters); `ASKRIGHTO_PROFILE_KEY_PREVIOUS`
 * has the same form and is still accepted for verification, so a key can be rotated without invalidating profiles
 * already handed out. With no key configured a random key is made at start-up: profiles then verify only on the
 * same running server, which is right for one instance and for development, and wrong for several instances.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface ProfileKey {
  id: string;
  secret: string;
}
export interface ProfileKeys {
  current: ProfileKey;
  previous?: ProfileKey;
}

function parseKey(v: string | undefined, name: string): ProfileKey | undefined {
  if (!v?.trim()) return undefined;
  const i = v.indexOf(":");
  const id = i > 0 ? v.slice(0, i) : "";
  const secret = i > 0 ? v.slice(i + 1) : "";
  if (!/^[A-Za-z0-9_-]{1,16}$/.test(id) || secret.length < 32) throw new Error(`${name} must look like "<id>:<secret>" with an id of up to 16 letters or digits and a secret of at least 32 characters`);
  return { id, secret };
}

export function profileKeysFrom(env: NodeJS.ProcessEnv): ProfileKeys {
  const current = parseKey(env.ASKRIGHTO_PROFILE_KEY, "ASKRIGHTO_PROFILE_KEY") ?? { id: "ephemeral", secret: randomBytes(32).toString("base64url") };
  const previous = parseKey(env.ASKRIGHTO_PROFILE_KEY_PREVIOUS, "ASKRIGHTO_PROFILE_KEY_PREVIOUS");
  return { current, ...(previous ? { previous } : {}) };
}

let keys: ProfileKeys | undefined;
export const profileKeys = (): ProfileKeys => (keys ??= profileKeysFrom(process.env));
/** For tests: replace the keys, or pass undefined to read the environment again. */
export const setProfileKeys = (k: ProfileKeys | undefined): void => {
  keys = k;
};

/** JSON with object keys sorted, so the signed text does not depend on key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

const mac = (k: ProfileKey, body: string): string => createHmac("sha256", k.secret).update(body).digest("hex");

/** The signature for a profile object without its `sig` field: "<key id>.<hex>". */
export function signBody(profile: Record<string, unknown>, k: ProfileKey = profileKeys().current): string {
  const { sig: _sig, ...rest } = profile;
  void _sig;
  return `${k.id}.${mac(k, canonical(rest))}`;
}

/** True only when `sig` is a valid signature of the rest of the profile under the current or previous key. */
export function verifyBody(profile: Record<string, unknown>): boolean {
  const sig = profile.sig;
  if (typeof sig !== "string") return false;
  const dot = sig.indexOf(".");
  if (dot < 1) return false;
  const id = sig.slice(0, dot);
  const { current, previous } = profileKeys();
  const k = [current, previous].find((x) => x && x.id === id);
  if (!k) return false;
  const want = Buffer.from(signBody(profile, k));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** A short-lived text signature for other purposes (the upload address token): "<key id>.<hex>" under the same keys, domain-separated. */
export function signText(purpose: string, text: string, k: ProfileKey = profileKeys().current): string {
  return `${k.id}.${mac(k, `${purpose}|${text}`)}`;
}
export function verifyText(purpose: string, text: string, sig: string): boolean {
  const dot = sig.indexOf(".");
  if (dot < 1) return false;
  const id = sig.slice(0, dot);
  const { current, previous } = profileKeys();
  const k = [current, previous].find((x) => x && x.id === id);
  if (!k) return false;
  const want = Buffer.from(signText(purpose, text, k));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
