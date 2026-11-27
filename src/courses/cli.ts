/** Command-line entry points: courses:validate, courses:load, sources:check. */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { parseCricos, type CricosCourse } from "./cricos.js";
import { dataDir } from "./data-dir.js";
import { loadCourses, mergeIndex, readProviderFiles } from "./load.js";
import { VCE_SOURCES } from "./sources.js";

const arg = (args: string[], name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const sha = () => {
  try {
    return execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
};
function fail(errors: string[]): never {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`${errors.length} problem(s)`);
  process.exit(1);
}

export function cliCoursesValidate(): void {
  const { files, errors } = readProviderFiles(dataDir());
  if (errors.length) fail(errors);
  console.log(`ok: ${files.length} providers (links only)`);
}

export async function cliCoursesLoad(args: string[]): Promise<void> {
  const { files, errors } = readProviderFiles(dataDir());
  if (errors.length) fail(errors);
  let cricos: CricosCourse[] = [];
  const f = arg(args, "--cricos");
  if (f) {
    const loc = arg(args, "--course-locations");
    const r = parseCricos(
      readFileSync(f, "utf8"),
      loc ? readFileSync(loc, "utf8") : undefined,
    );
    if (r.problems.length) fail(r.problems.map((p) => `CRICOS file: ${p}`));
    cricos = r.courses;
  }
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    const merged = mergeIndex(files, cricos);
    const r = await loadCourses(db, merged, {
      cricos,
      ...(sha() ? { gitSha: sha() } : {}),
    });
    console.log(
      r.changed ? "Loaded." : "No change (same content as the last load).",
    );
    console.log(JSON.stringify(r.report, null, 2));
    for (const w of r.report.warnings) console.log(`warning: ${w}`);
  } finally {
    await db.close();
  }
}

/** Fetches each indexed link at most once a second and reports status and redirects. Never writes any file or keeps content. */
export async function cliSourcesCheck(): Promise<void> {
  const { files, errors } = readProviderFiles(dataDir());
  if (errors.length) fail(errors);
  const urls = new Set<string>(VCE_SOURCES.map((s) => s.url));
  for (const f of files) {
    urls.add(f.provider.coursesUrl);
    if (f.provider.searchUrl) urls.add(f.provider.searchUrl);
  }
  let bad = 0;
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        redirect: "follow",
        headers: {
          "user-agent":
            "AskRighto-link-check/0.1 (+https://askrighto.feimacode.com)",
        },
      });
      const blocked = r.status === 403 || r.status === 429;
      if (!r.ok && !blocked) bad++;
      console.log(
        `${r.status}${r.redirected ? ` -> ${r.url}` : ""} ${u}${blocked ? "  (blocked: check by hand)" : ""}`,
      );
    } catch (e) {
      bad++;
      console.log(`ERR ${u} (${(e as Error).message}): check by hand`);
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  if (bad) {
    console.error(`${bad} link(s) failed`);
    process.exit(1);
  }
}
