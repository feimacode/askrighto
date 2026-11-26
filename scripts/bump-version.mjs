// Sets one version everywhere a release checks it, regenerates the plugin files, commits and tags
// locally. Never pushes: pushing the tag is what starts release.yml, so it stays a deliberate step.
// Pattern from feimacode/open-design-agent-kit (scripts/bump-version.mjs).
//
//   npm run release:bump -- <x.y.z | x.y.z-alpha.N | x.y.z-beta.N> [--dry-run] [--no-git]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
export const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta)\.[0-9]+)?$/;

/** Files holding the version, and how to read and set it. */
export const VERSION_FILES = [
  { file: "package.json", get: (j) => j.version, set: (j, v) => void (j.version = v) },
  {
    file: "package-lock.json",
    get: (j) => j.version,
    set: (j, v) => {
      j.version = v;
      if (j.packages?.[""]) j.packages[""].version = v;
    },
  },
  { file: "plugin/askrighto.config.json", get: (j) => j.version, set: (j, v) => void (j.version = v) },
  { file: "plugin-internal/.claude-plugin/plugin.json", get: (j) => j.version, set: (j, v) => void (j.version = v) },
];

export function readVersions(root = ROOT) {
  return VERSION_FILES.map(({ file, get }) => ({
    file,
    version: get(JSON.parse(readFileSync(join(root, file), "utf8"))),
  }));
}

/** The changelog section for a version, or null. Sections start with `## [x.y.z]`. */
export function changelogSection(text, version) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## ["));
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join("\n").trim();
}

/** Problems with a changelog section; empty when it is fit to release. */
export function changelogProblems(text, version) {
  const s = changelogSection(text, version);
  if (!s) return [`CHANGELOG.md has no "## [${version}]" section`];
  return /^\*\*Listing impact:\*\* (none|rescan|resubmit)\b/m.test(s)
    ? []
    : [`CHANGELOG.md [${version}] needs a "**Listing impact:** none|rescan|resubmit" line`];
}

/** True when any of `paths` has staged changes. */
function hasStagedChanges(paths) {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet", "--", ...paths], { cwd: ROOT });
    return false;
  } catch (e) {
    if (e.status === 1) return true;
    throw e;
  }
}

function main(argv) {
  const version = argv.find((a) => !a.startsWith("--"));
  const dryRun = argv.includes("--dry-run");
  const noGit = argv.includes("--no-git");
  if (!version || !VERSION_PATTERN.test(version)) {
    console.error("usage: npm run release:bump -- <x.y.z|x.y.z-alpha.N|x.y.z-beta.N> [--dry-run] [--no-git]");
    process.exit(1);
  }
  const problems = changelogProblems(readFileSync(join(ROOT, "CHANGELOG.md"), "utf8"), version);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  const changed = [];
  for (const { file, get, set } of VERSION_FILES) {
    const path = join(ROOT, file);
    const j = JSON.parse(readFileSync(path, "utf8"));
    const from = get(j);
    if (from === version) continue;
    console.log(`${file}: ${from} -> ${version}${dryRun ? " (dry run)" : ""}`);
    if (dryRun) continue;
    set(j, version);
    writeFileSync(path, JSON.stringify(j, null, 2) + "\n");
    changed.push(file);
  }
  if (dryRun) return;
  // The committed manifests carry the version too.
  execFileSync(process.execPath, [join(ROOT, "scripts/plugin.mjs")], { stdio: "inherit" });
  if (noGit) return;
  const tag = `v${version}`;
  const tagExists = execFileSync("git", ["tag", "--list", tag], { cwd: ROOT, encoding: "utf8" }).trim();
  if (tagExists) {
    console.error(`${tag} already exists. Never move or reuse a tag: release a new version instead.`);
    process.exit(1);
  }
  // Commit only the version files and the regenerated manifests, never other local changes.
  const paths = [...changed, "plugin", ".claude-plugin"];
  execFileSync("git", ["add", "--", ...paths], { cwd: ROOT });
  if (hasStagedChanges(paths))
    execFileSync("git", ["commit", "-m", `Release ${tag}`, "--", ...paths], { cwd: ROOT, stdio: "inherit" });
  else console.log(`Every file is already at ${version}: nothing to commit, tagging the current commit.`);
  execFileSync("git", ["tag", "-a", tag, "-m", tag], { cwd: ROOT });
  console.log(`Tagged v${version} locally. Push with: git push origin main --follow-tags`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
