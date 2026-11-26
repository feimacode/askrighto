// Unzips each built package outside the checkout and checks what the directories check, so a bad
// zip fails in CI instead of in a review queue. Run by `npm run plugin:build`, or alone:
//   node scripts/check-plugin-zips.mjs [dir]     (default dist/plugins)
// Limits come from the OpenAI submission page and the Claude pre-submission checklist, read 26 Nov 2026.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "plugin/askrighto.config.json"), "utf8"));
const dir = resolve(process.argv[2] ?? join(ROOT, "dist/plugins"));
const problems = [];
const bad = (zip, msg) => problems.push(`${zip}: ${msg}`);

function walk(d, base = d) {
  const out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isSymbolicLink()) out.push({ rel: relative(base, p), link: true, size: 0 });
    else if (e.isDirectory()) out.push(...walk(p, base));
    else out.push({ rel: relative(base, p), size: statSync(p).size });
  }
  return out;
}
const pngSize = (file) => {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString("latin1", 1, 4) !== "PNG") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
};
const words = (t) => t.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;

function common(name, root, files) {
  const rels = files.map((f) => f.rel);
  const skills = readdirSync(join(root, "skills")).sort();
  if (JSON.stringify(skills) !== JSON.stringify([...CONFIG.publicSkills].sort()))
    bad(name, `skills ${skills.join(",")} are not the public skills`);
  for (const f of files) {
    if (f.link) bad(name, `${f.rel} is a symlink`);
    if (f.size > 5 * 1024 * 1024) bad(name, `${f.rel} is over 5 MiB`);
    if (/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX)/.test(f.rel)) bad(name, `${f.rel} is junk`);
    if (/(^|\/)(bin|hooks)\//.test(f.rel) || /\.(exe|dll|so|mcpb|dxt)$/.test(f.rel)) bad(name, `${f.rel} must not ship`);
    if (/^\.app\.json$|\/\.app\.json$/.test(f.rel)) bad(name, `${f.rel}: OpenAI cannot take app references`);
  }
  if (rels.some((r) => /^skills\/(vce|course|health|home-loan)/.test(r))) bad(name, "an internal skill is packaged");
  const host = new URL(CONFIG.serverUrl).host;
  for (const f of files) {
    if (!/\.(json|md|txt)$/.test(f.rel) && !/SKILL\.md$/.test(f.rel)) continue;
    const t = readFileSync(join(root, f.rel), "utf8");
    if (/mcp-internal|readyz-internal|metrics-internal/.test(t)) bad(name, `${f.rel} names an internal route`);
    for (const m of t.matchAll(/https?:\/\/(askrighto\.[a-z.]+)/g))
      if (m[1] !== host) bad(name, `${f.rel} names ${m[1]}, not ${host}`);
  }
}

function checkClaude(name, root, files) {
  const manifests = files.filter((f) => f.rel.endsWith(".claude-plugin/plugin.json"));
  if (manifests.length !== 1 || manifests[0].rel !== ".claude-plugin/plugin.json")
    return bad(name, "needs exactly one .claude-plugin/plugin.json at the zip root");
  const m = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
  for (const k of ["name", "description", "version", "author", "license", "icon", "privacyPolicyUrl", "supportUrl", "termsOfServiceUrl"])
    if (!m[k]) bad(name, `plugin.json is missing ${k}`);
  if (m.hooks || m.userConfig) bad(name, "plugin.json has hooks or userConfig");
  const icon = pngSize(join(root, m.icon ?? "missing"));
  if (!icon || icon.w !== icon.h || icon.w < 512 || icon.w > 2048 || icon.bytes > 2 * 1024 * 1024)
    bad(name, "icon must be a square PNG of 512 to 2048 px under 2 MB");
  if (!existsSync(join(root, "LICENSE"))) bad(name, "LICENSE is missing");
  if (!existsSync(join(root, "README.md")) || words(readFileSync(join(root, "README.md"), "utf8")) < 40)
    bad(name, "README.md is missing or under 40 words");
  const mcp = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
  const urls = Object.values(mcp.mcpServers).map((s) => s.url);
  if (urls.length !== 1 || urls[0] !== CONFIG.serverUrl || !urls[0].startsWith("https://")) bad(name, ".mcp.json must name the one https server URL");
  common(name, root, files);
}

function checkChatgpt(name, root, files) {
  const m = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
  const o = m.extensions?.["com.openai"];
  const ui = o?.interface ?? {};
  const max = { displayName: 30, shortDescription: 30, longDescription: 4000 };
  for (const [k, n] of Object.entries(max))
    if (typeof ui[k] !== "string" || !ui[k] || ui[k].length > n) bad(name, `interface.${k} must be 1-${n} characters`);
  for (const k of ["developerName", "category", "websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL", "logo", "composerIcon"])
    if (!ui[k]) bad(name, `interface.${k} is missing`);
  for (const k of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"])
    if (ui[k] && (!ui[k].startsWith("https://") || ui[k].length > 1024)) bad(name, `interface.${k} must be https and under 1024 characters`);
  if (!Array.isArray(ui.defaultPrompt) || ui.defaultPrompt.length > 3 || ui.defaultPrompt.some((p) => p.length > 128))
    bad(name, "interface.defaultPrompt is at most 3 prompts of 128 characters");
  if ((m.keywords ?? []).length > 25) bad(name, "more than 25 keywords");
  const icon = pngSize(join(root, ui.logo ?? "missing"));
  if (!icon || icon.w !== icon.h || icon.w < 48 || icon.w > 4096 || icon.bytes > 5 * 1024 * 1024) bad(name, "logo must be a square PNG, 48 to 4096 px, under 5 MiB");
  if (!existsSync(join(root, o?.onboardingSkill ?? "missing"))) bad(name, "onboardingSkill does not exist");
  const text = JSON.stringify(m);
  if (/"hooks"|userConfig|"apps"|test_credentials|reviewer_instructions/.test(text)) bad(name, "plugin.json has a field the portal rejects");
  const t = o?.review?.test_cases;
  if (!t || t.positive?.length < 5 || t.negative?.length < 3) bad(name, "review needs 5 positive and 3 negative test cases");
  for (const c of t?.positive ?? []) for (const k of ["description", "prompt", "tools_triggered", "expected_behavior"]) if (!c[k]) bad(name, `a positive test case lacks ${k}`);
  const mcp = JSON.parse(readFileSync(join(root, "mcp.json"), "utf8"));
  const servers = Object.values(mcp.mcpServers);
  if (servers.length !== 1) bad(name, "exactly one MCP server per plugin");
  const s = servers[0];
  if (s.type !== "streamable-http" || s.url !== CONFIG.serverUrl) bad(name, "mcp.json must be streamable-http at the server URL");
  if (s.headers && Object.keys(s.headers).length) bad(name, "public submission rejects server headers");
  if (s.extensions) bad(name, "mcp.json server must have no extensions block: ChatGPT then installs the zip without the server");
  common(name, root, files);
}

function checkGemini(name, root, files) {
  const m = JSON.parse(readFileSync(join(root, "gemini-extension.json"), "utf8"));
  if (!/^[a-z0-9-]+$/.test(m.name ?? "")) bad(name, "name must be lowercase letters, numbers and dashes");
  if (m.mcpServers?.[CONFIG.serverName]?.httpUrl !== CONFIG.serverUrl) bad(name, "mcpServers must use httpUrl at the server URL");
  if (!existsSync(join(root, m.contextFileName ?? "GEMINI.md"))) bad(name, "context file is missing");
  common(name, root, files);
}

const zips = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".zip")) : [];
if (zips.length !== 3) bad("dist", `expected 3 zips in ${dir}, found ${zips.length}`);
for (const z of zips) {
  const tmp = mkdtempSync(join(tmpdir(), "plugin-zip-"));
  try {
    execFileSync("unzip", ["-q", join(dir, z), "-d", tmp]);
    const files = walk(tmp);
    if (statSync(join(dir, z)).size > 50 * 1024 * 1024) bad(z, "over 50 MiB");
    if (z.includes("claude")) checkClaude(z, tmp, files);
    else if (z.includes("chatgpt")) checkChatgpt(z, tmp, files);
    else if (z.includes("gemini")) checkGemini(z, tmp, files);
  } catch (e) {
    bad(z, e.message);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`plugin zips ok: ${zips.join(", ")}`);
