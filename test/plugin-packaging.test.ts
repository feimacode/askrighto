import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  challengeResponse,
  CHALLENGE_PATH,
  GOOGLE_CONNECTED_APPS_PATH,
  googleConnectedAppsResponse,
} from "../src/server/challenge.js";
// @ts-expect-error plain .mjs script, no types
import * as gen from "../scripts/plugin.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const config = JSON.parse(
  readFileSync(join(ROOT, "plugin/askrighto.config.json"), "utf8"),
);
const g = gen as {
  claudeManifest: () => Record<string, unknown>;
  claudeMcp: () => Record<string, unknown>;
  chatgptManifest: () => Record<string, unknown>;
  chatgptMcp: () => Record<string, unknown>;
  marketplace: () => Record<string, unknown>;
  geminiSheet: (t: { name: string }[]) => string;
};

describe("plugin packaging", () => {
  it("keeps the committed GitHub marketplace files in step with the config", () => {
    expect(() =>
      execFileSync("node", ["scripts/plugin.mjs", "--check"], {
        cwd: ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("uses the configured server URL in every package and no other host", () => {
    const texts = [
      JSON.stringify(g.claudeMcp()),
      JSON.stringify(g.chatgptMcp()),
      g.geminiSheet([]),
    ];
    for (const t of texts) expect(t).toContain(config.serverUrl);
    const host = new URL(config.serverUrl).host;
    for (const t of texts) {
      for (const m of t.matchAll(/https?:\/\/([a-z0-9.-]+)/g)) {
        // The sheet and manifests may name the homepage and repository; the server host must be the configured one.
        if (/askrighto\.(feimacode\.com|com\.au)$/.test(m[1]!) && m[1] !== host)
          expect(`${m[1]} in ${t.slice(0, 40)}`).toBe(host);
      }
    }
  });

  it("builds a Claude plugin that bundles the remote server", () => {
    expect(g.claudeMcp()).toEqual({
      mcpServers: {
        askrighto: { type: "http", url: config.serverUrl },
      },
    });
  });

  it("builds a ChatGPT package with streamable-http and none of the rejected fields", () => {
    const mcp = JSON.stringify(g.chatgptMcp());
    expect(mcp).toContain('"streamable-http"');
    const manifest = Object.keys(g.chatgptManifest());
    for (const k of ["hooks", "userConfig", "agents", "mcpServers", "apps"])
      expect(manifest).not.toContain(k);
    expect(`${mcp}${JSON.stringify(g.chatgptManifest())}`).not.toMatch(
      /userConfig|\bhooks\b/,
    );
  });

  it("puts no extensions block on the ChatGPT server (ChatGPT then drops the server)", () => {
    const servers = Object.values(
      (g.chatgptMcp() as { mcpServers: Record<string, object> }).mcpServers,
    );
    for (const s of servers) expect(s).not.toHaveProperty("extensions");
  });

  it("lists exactly the public skills and none of the internal ones", () => {
    const pub = readdirSync(join(ROOT, "plugin/skills")).sort();
    expect(pub).toEqual([...config.publicSkills].sort());
    const internal = readdirSync(join(ROOT, "plugin-internal/skills"));
    for (const n of internal) expect(pub).not.toContain(n);
  });

  it("never puts an internal route or token into a package", () => {
    const all = [
      JSON.stringify(g.claudeMcp()),
      JSON.stringify(g.chatgptMcp()),
      JSON.stringify(g.marketplace()),
      g.geminiSheet([]),
    ].join("\n");
    expect(all).not.toMatch(/mcp-internal|readyz-internal|metrics-internal/);
    expect(existsSync(join(ROOT, "plugin/skills/vce-course-research"))).toBe(
      false,
    );
  });
});

describe("domain verification route", () => {
  it("answers with the token when it is set", () => {
    expect(
      challengeResponse({ ASKRIGHTO_OPENAI_CHALLENGE: " tok-123 " }),
    ).toEqual({ status: 200, body: "tok-123" });
  });

  it("is a 404 when the token is not set", () => {
    expect(challengeResponse({}).status).toBe(404);
    expect(challengeResponse({ ASKRIGHTO_OPENAI_CHALLENGE: "  " }).status).toBe(
      404,
    );
  });

  it("uses the path the OpenAI portal expects", () => {
    expect(CHALLENGE_PATH).toBe("/.well-known/openai-apps-challenge");
  });
});

describe("Google Connected Apps domain file", () => {
  it("serves the JSON when it is set and valid", () => {
    const r = googleConnectedAppsResponse({
      ASKRIGHTO_GOOGLE_CONNECTED_APPS: '{"a":1}',
    });
    expect(r).toEqual({
      status: 200,
      body: '{"a":1}',
      type: "application/json",
    });
  });

  it("is a 404 when unset or not JSON", () => {
    expect(googleConnectedAppsResponse({}).status).toBe(404);
    expect(
      googleConnectedAppsResponse({ ASKRIGHTO_GOOGLE_CONNECTED_APPS: "nope" })
        .status,
    ).toBe(404);
  });

  it("uses the path Google expects", () => {
    expect(GOOGLE_CONNECTED_APPS_PATH).toBe(
      "/.well-known/google-connected-apps",
    );
  });
});

describe("listing readiness", () => {
  const TRACKED = [
    "plugin/askrighto.config.json",
    "plugin/.claude-plugin/plugin.json",
    "plugin/.mcp.json",
    "plugin/README.md",
    ".claude-plugin/marketplace.json",
  ];

  it("names no old domain in the packaged files", () => {
    for (const f of TRACKED)
      expect(readFileSync(join(ROOT, f), "utf8")).not.toContain(
        "askrighto.com.au",
      );
  });

  it("sets the listing fields the directories ask for", () => {
    const m = g.claudeManifest() as Record<string, unknown>;
    for (const k of [
      "license",
      "author",
      "icon",
      "privacyPolicyUrl",
      "supportUrl",
      "termsOfServiceUrl",
    ])
      expect(m[k], k).toBeTruthy();
    expect(existsSync(join(ROOT, "plugin", config.icon))).toBe(true);
    expect(existsSync(join(ROOT, "LICENSE"))).toBe(true);
  });

  it("keeps ChatGPT listing text within OpenAI's limits and has the review cases", () => {
    const o = (g.chatgptManifest() as any).extensions["com.openai"];
    expect(o.interface.displayName.length).toBeLessThanOrEqual(30);
    expect(o.interface.shortDescription.length).toBeLessThanOrEqual(30);
    expect(o.interface.longDescription.length).toBeLessThanOrEqual(4000);
    expect(o.interface.defaultPrompt.length).toBeLessThanOrEqual(3);
    expect(o.review.test_cases.positive.length).toBeGreaterThanOrEqual(5);
    expect(o.review.test_cases.negative.length).toBeGreaterThanOrEqual(3);
  });

  it.skipIf(!existsSync(join(ROOT, "dist/askrighto.js")))(
    "builds three zips that pass the zip checker",
    () => {
      execFileSync("node", ["scripts/plugin.mjs", "--build"], {
        cwd: ROOT,
        stdio: "pipe",
      });
      for (const z of [
        "askrighto-claude-plugin.zip",
        "askrighto-chatgpt-plugin.zip",
        "askrighto-gemini-extension.zip",
      ])
        expect(existsSync(join(ROOT, "dist/plugins", z)), z).toBe(true);
    },
    120_000,
  );
});
