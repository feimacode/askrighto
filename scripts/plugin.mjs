// Builds the plugin packages from plugin/askrighto.config.json (the single source).
//
//   node scripts/plugin.mjs            writes the committed GitHub marketplace files
//                                      (plugin/.claude-plugin/plugin.json, plugin/.mcp.json,
//                                      .claude-plugin/marketplace.json)
//   node scripts/plugin.mjs --check    fails if those committed files are stale
//   node scripts/plugin.mjs --build    also writes dist/plugins/{claude,chatgpt,gemini}, three upload-ready
//                                      zips (askrighto-claude-plugin.zip, askrighto-chatgpt-plugin.zip,
//                                      askrighto-gemini-extension.zip) and SHA256SUMS
//
// The packages hold only the public skills and the public server URL. The internal route (its URL
// carries a secret token) and the internal skills are never included.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CONFIG = JSON.parse(
  readFileSync(join(ROOT, "plugin/askrighto.config.json"), "utf8"),
);
const json = (o) => JSON.stringify(o, null, 2) + "\n";

/** Claude plugin manifest (also the source of truth for the committed copy). */
export function claudeManifest(c = CONFIG) {
  return {
    name: c.name,
    displayName: c.displayName,
    version: c.version,
    description: c.description,
    author: c.author,
    homepage: c.homepage,
    repository: c.repository,
    license: c.license,
    keywords: c.keywords,
    icon: `./${c.icon}`,
    documentationUrl: c.links.documentation,
    supportUrl: c.links.support,
    privacyPolicyUrl: c.links.privacy,
    termsOfServiceUrl: c.links.terms,
  };
}

/** Claude `.mcp.json`: the remote server, started when the plugin is enabled. */
export function claudeMcp(c = CONFIG) {
  return { mcpServers: { [c.serverName]: { type: "http", url: c.serverUrl } } };
}

/**
 * Internal plugin `.mcp.json`: the internal route for testers. The token is never in the repo; Claude
 * Code fills `${ASKRIGHTO_INTERNAL_TOKEN}` from the tester's environment. Only the internal plugin
 * (not packaged for any directory) carries this file.
 */
export function internalMcp(c = CONFIG) {
  const origin = new URL(c.serverUrl).origin;
  return {
    mcpServers: {
      [`${c.serverName}-internal`]: {
        type: "http",
        url: `${origin}/mcp-internal/\${ASKRIGHTO_INTERNAL_TOKEN}`,
      },
    },
  };
}

export function marketplace(c = CONFIG) {
  const m = c.marketplace;
  return {
    name: m.name,
    description: m.description,
    owner: { name: m.owner },
    plugins: [
      { name: c.name, source: "./plugin", description: m.pluginDescription },
      {
        name: `${c.name}-internal`,
        source: "./plugin-internal",
        description: m.internalDescription,
      },
    ],
  };
}

/** ChatGPT / portable plugin manifest. No hooks, userConfig or Claude-only fields. */
export function chatgptManifest(c = CONFIG) {
  const o = c.openai;
  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: c.name,
    version: c.version,
    description: c.description,
    author: c.author,
    homepage: c.homepage,
    repository: c.repository,
    license: c.license,
    keywords: c.keywords,
    extensions: {
      "com.openai": {
        onboardingSkill: o.onboardingSkill,
        interface: {
          displayName: c.displayName,
          shortDescription: o.shortDescription,
          longDescription: o.longDescription,
          developerName: c.author.name,
          category: o.category,
          capabilities: o.capabilities,
          websiteURL: c.homepage,
          supportURL: c.links.support,
          privacyPolicyURL: c.links.privacy,
          termsOfServiceURL: c.links.terms,
          defaultPrompt: o.defaultPrompt,
          brandColor: o.brandColor,
          composerIcon: `./${c.icon}`,
          logo: `./${c.icon}`,
        },
        // Review metadata for the portal (remote MCP plugins), as in open-design-agent-kit.
        review: o.review,
        publication: { release_notes: o.releaseNotes },
      },
    },
  };
}

/** Gemini CLI extension manifest. The server is remote streamable HTTP, so `httpUrl`. */
export function geminiManifest(c = CONFIG) {
  return {
    name: c.geminiExtensionName,
    version: c.version,
    description: c.description,
    contextFileName: "GEMINI.md",
    mcpServers: { [c.serverName]: { httpUrl: c.serverUrl } },
  };
}

export function geminiContext(c = CONFIG) {
  return `# ${c.displayName}\n\n${c.gemini.context}\n`;
}

/**
 * ChatGPT `mcp.json`: one streamable-http server, public data so no sign-in. No
 * `extensions["com.openai"].auth` block: with it, ChatGPT desktop installed an uploaded zip with the
 * skills but without the server (Iven, 27 Nov 2026); without it the server is added (same shape as
 * open-design-agent-kit's hosted zip). Auth "none" is chosen in the portal instead.
 */
export function chatgptMcp(c = CONFIG) {
  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      [c.serverName]: {
        type: "streamable-http",
        url: c.serverUrl,
      },
    },
  };
}

const COMMITTED = () => ({
  "plugin/.claude-plugin/plugin.json": json(claudeManifest()),
  "plugin/.mcp.json": json(claudeMcp()),
  "plugin-internal/.mcp.json": json(internalMcp()),
  ".claude-plugin/marketplace.json": json(marketplace()),
});

function publicSkills() {
  const dir = join(ROOT, "plugin/skills");
  const onDisk = readdirSync(dir).sort();
  const wanted = [...CONFIG.publicSkills].sort();
  if (JSON.stringify(onDisk) !== JSON.stringify(wanted))
    throw new Error(
      `plugin/skills (${onDisk.join(", ")}) does not match publicSkills in the config (${wanted.join(", ")})`,
    );
  return dir;
}

function write(rel, text) {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

export function geminiSheet(tools, c = CONFIG) {
  const rows = tools
    .map(
      (t) =>
        `| ${t.name} | ${t.readOnlyHint} | ${t.destructiveHint} | ${t.openWorldHint} |`,
    )
    .join("\n");
  const g = c.gemini;
  return `# Gemini registration sheet

Generated by \`npm run plugin:build\`. The Gemini app registers the server, not a skills package.

## Consumer: Gemini app, Settings > Connected Apps > Add a custom app

- Server URL: ${c.serverUrl}
- Transport: standard MCP over HTTPS, no sign-in (public data)
- Each user adds it themselves (US, English, age 18 or over, personal Google account as of 26 Nov 2026).

## Developer: Connected Console (preview, apply first)

- App name: ${c.displayName}
- Description (under 30 words): ${g.appDescription}
- Capabilities (at least 3): ${g.capabilities.join("; ")}
- Example prompts (at least 3, two or more start with the @ name): ${g.examplePrompts.join(" | ")}
- Icon: ${c.icon} (512x512 PNG, under 1 MB)
- Terms of Service URL: ${c.links.terms}
- Policy URL: ${c.links.privacy}
- MCP endpoint: ${c.serverUrl}
- Domain file: served at /.well-known/google-connected-apps from env ASKRIGHTO_GOOGLE_CONNECTED_APPS
- Authorization: none

A tool with a missing annotation is treated as destructive, so every tool must set all three hints:

| Tool | readOnlyHint | destructiveHint | openWorldHint |
| --- | --- | --- | --- |
${rows}
`;
}

const ICON = () => join(ROOT, "plugin", CONFIG.icon);

function zip(dir, out) {
  rmSync(out, { force: true });
  execFileSync("zip", ["-qrX", out, "."], { cwd: dir });
}

async function buildDist() {
  const skills = publicSkills();
  const dist = join(ROOT, "dist/plugins");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  // Claude: the plugin folder's contents (Customize > Plugins > Add > Upload plugin takes the zip).
  const claude = join(dist, "claude");
  cpSync(skills, join(claude, "skills"), { recursive: true });
  mkdirSync(join(claude, ".claude-plugin"), { recursive: true });
  writeFileSync(join(claude, ".claude-plugin/plugin.json"), json(claudeManifest()));
  writeFileSync(join(claude, ".mcp.json"), json(claudeMcp()));
  mkdirSync(join(claude, "assets"), { recursive: true });
  cpSync(ICON(), join(claude, CONFIG.icon));
  cpSync(join(ROOT, "plugin/README.md"), join(claude, "README.md"));
  cpSync(join(ROOT, "LICENSE"), join(claude, "LICENSE"));
  zip(claude, join(dist, "askrighto-claude-plugin.zip"));

  // ChatGPT: remote MCP plugin for the portal ("With MCP") and for manual upload.
  const chatgpt = join(dist, "chatgpt");
  cpSync(skills, join(chatgpt, "skills"), { recursive: true });
  mkdirSync(join(chatgpt, "assets"), { recursive: true });
  cpSync(ICON(), join(chatgpt, CONFIG.icon));
  writeFileSync(join(chatgpt, "plugin.json"), json(chatgptManifest()));
  writeFileSync(join(chatgpt, "mcp.json"), json(chatgptMcp()));
  zip(chatgpt, join(dist, "askrighto-chatgpt-plugin.zip"));

  // Gemini CLI extension (gemini extensions install <github url> or unzip into ~/.gemini/extensions).
  const gemini = join(dist, "gemini-extension");
  cpSync(skills, join(gemini, "skills"), { recursive: true });
  writeFileSync(join(gemini, "gemini-extension.json"), json(geminiManifest()));
  writeFileSync(join(gemini, "GEMINI.md"), geminiContext());
  cpSync(join(ROOT, "LICENSE"), join(gemini, "LICENSE"));
  zip(gemini, join(dist, "askrighto-gemini-extension.zip"));

  // The Gemini sheet reads the tools from the built server (npm run build first).
  const tools = await listToolsFromServer();
  mkdirSync(join(dist, "gemini"), { recursive: true });
  writeFileSync(join(dist, "gemini/registration.md"), geminiSheet(tools));
  const missing = tools.filter(
    (t) => t.readOnlyHint === undefined || t.destructiveHint === undefined || t.openWorldHint === undefined,
  );
  if (missing.length)
    throw new Error(`tools missing an annotation: ${missing.map((t) => t.name).join(", ")}`);

  const sums = readdirSync(dist)
    .filter((f) => f.endsWith(".zip"))
    .sort()
    .map((f) => `${createHash("sha256").update(readFileSync(join(dist, f))).digest("hex")}  ${f}`);
  writeFileSync(join(dist, "SHA256SUMS"), sums.join("\n") + "\n");
  execFileSync(process.execPath, [join(ROOT, "scripts/check-plugin-zips.mjs")], { stdio: "inherit" });
}

/** Starts the built server on stdio and lists its tools with their annotations. */
async function listToolsFromServer() {
  const { Client } = await import("@modelcontextprotocol/client");
  const { StdioClientTransport } = await import("@modelcontextprotocol/client/stdio");
  const env = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !/^(DATABASE_|ASKRIGHTO_|TEST_DATABASE_URL)/.test(k)) env[k] = v;
  const client = new Client({ name: "plugin-build", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [join(ROOT, "dist/askrighto.js")],
      env,
    }),
  );
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((t) => ({
    name: t.name,
    readOnlyHint: t.annotations?.readOnlyHint,
    destructiveHint: t.annotations?.destructiveHint,
    openWorldHint: t.annotations?.openWorldHint,
  }));
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes("--check")) {
    publicSkills();
    let stale = false;
    for (const [rel, text] of Object.entries(COMMITTED())) {
      const actual = existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : "";
      if (actual !== text) {
        console.error(`${rel} is stale: run \`npm run plugin:sync\``);
        stale = true;
      }
    }
    process.exit(stale ? 1 : 0);
  } else {
    publicSkills();
    for (const [rel, text] of Object.entries(COMMITTED())) write(rel, text);
    if (args.includes("--build")) await buildDist();
  }
}
