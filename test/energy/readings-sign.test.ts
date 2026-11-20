import { afterEach, describe, expect, it } from "vitest";
import { canonical, profileKeysFrom, setProfileKeys, signBody, verifyBody } from "../../src/energy/readings/sign.js";

const K1 = { id: "k1", secret: "a".repeat(40) };
const K2 = { id: "k2", secret: "b".repeat(40) };
const body = { v: 1, state: "VIC", sums: [[1, 2], [3]], from: "2026-01-01" };

afterEach(() => setProfileKeys(undefined));

describe("profile signing", () => {
  it("verifies an untouched body and rejects any change, a missing or a malformed signature", () => {
    setProfileKeys({ current: K1 });
    const sig = signBody(body);
    expect(sig.startsWith("k1.")).toBe(true);
    expect(verifyBody({ ...body, sig })).toBe(true);
    expect(verifyBody({ ...body, state: "NSW", sig })).toBe(false);
    expect(verifyBody({ ...body, sums: [[1, 2], [3.5]], sig })).toBe(false);
    expect(verifyBody(body)).toBe(false);
    expect(verifyBody({ ...body, sig: "nodot" })).toBe(false);
    expect(verifyBody({ ...body, sig: "k1.zz" })).toBe(false);
  });
  it("does not depend on key order", () => {
    setProfileKeys({ current: K1 });
    const sig = signBody(body);
    expect(verifyBody({ sums: body.sums, from: body.from, state: body.state, v: 1, sig })).toBe(true);
    expect(canonical({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
  });
  it("accepts the previous key for one rotation and refuses an unknown key", () => {
    setProfileKeys({ current: K1 });
    const old = signBody(body);
    setProfileKeys({ current: K2, previous: K1 });
    expect(verifyBody({ ...body, sig: old })).toBe(true);
    expect(verifyBody({ ...body, sig: signBody(body) })).toBe(true);
    setProfileKeys({ current: K2 });
    expect(verifyBody({ ...body, sig: old })).toBe(false);
  });
  it("reads keys from the environment and refuses a weak or malformed one", () => {
    const k = profileKeysFrom({ ASKRIGHTO_PROFILE_KEY: `k9:${"c".repeat(32)}`, ASKRIGHTO_PROFILE_KEY_PREVIOUS: `k8:${"d".repeat(32)}` });
    expect(k.current.id).toBe("k9");
    expect(k.previous?.id).toBe("k8");
    expect(() => profileKeysFrom({ ASKRIGHTO_PROFILE_KEY: "short" })).toThrow(/ASKRIGHTO_PROFILE_KEY/);
    expect(() => profileKeysFrom({ ASKRIGHTO_PROFILE_KEY: `:${"c".repeat(40)}` })).toThrow();
    expect(profileKeysFrom({}).current.id).toBe("ephemeral");
  });
});
