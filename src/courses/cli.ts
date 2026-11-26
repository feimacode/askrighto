/** Command-line entry points: courses:validate, courses:load, courses:check-pages, vce:validate, vce:load. */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { loadVce, readVceFiles } from "../vce/load.js";
import { sharedRun } from "./verbatim.js";
import { parseCricos, type CricosCourse } from "./cricos.js";
import { loadCourses, mergeIndex, readProviderFiles } from "./load.js";
import { dataDir } from "./studies.js";
import { matchStandins, standinSummary } from "./standins.js";

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
  const m = mergeIndex(files);
  console.log(
    `ok: ${m.report.courses} courses (${JSON.stringify(m.report.byDepth)}); ${m.report.withoutOfficialLink.length} without an official link`,
  );
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
    console.log(
      JSON.stringify(
        {
          ...r.report,
          withoutOfficialLink: r.report.withoutOfficialLink.length,
        },
        null,
        2,
      ),
    );
    for (const w of r.report.warnings) console.log(`warning: ${w}`);
  } finally {
    await db.close();
  }
}

/** Fetches each cited URL at most once a second and reports status and redirects. Never writes any file. */
export async function cliCoursesCheckPages(): Promise<void> {
  const { files, errors } = readProviderFiles(dataDir());
  if (errors.length) fail(errors);
  const urls = new Set<string>();
  // Our own-words text per official page, to compare with the fetched page.
  const ours = new Map<string, string[]>();
  for (const f of files)
    for (const c of f.courses)
      if (c.depth === "curated") {
        const texts = [c.summary, ...c.prerequisites.map((x) => x.text)].filter(
          (t): t is string => !!t,
        );
        for (const u of [
          c.officialUrl,
          ...c.prerequisites.map((x) => x.sourceUrl),
        ])
          if (u) ours.set(u, [...(ours.get(u) ?? []), ...texts]);
        for (const u of [
          c.officialUrl,
          ...c.entryFigures.map((x) => x.sourceUrl),
          ...c.prerequisites.map((x) => x.sourceUrl),
        ])
          if (u) urls.add(u);
      }
  for (const u of urls) {
    try {
      const r = await fetch(u, {
        redirect: "follow",
        headers: {
          "user-agent": "AskRighto-link-check/0.1 (+https://askrighto.feimacode.com)",
        },
      });
      console.log(
        `${r.status}${r.redirected ? ` -> ${r.url}` : ""} ${u}${r.status === 403 || r.status === 429 ? "  (blocked: check by hand)" : ""}`,
      );
      if (r.ok && ours.has(u)) {
        const body = await r.text();
        for (const t of ours.get(u)!) {
          const run = sharedRun(t, body);
          if (run) console.log(`  VERBATIM RUN (12+ words): "${run}"`);
        }
        // A page with almost no text is probably script-rendered: the check proves nothing there.
        if (body.replace(/<[^>]+>/g, "").trim().length < 500)
          console.log("  little text in the page: check by hand");
      }
    } catch (e) {
      console.log(`ERR ${u} (${(e as Error).message}): check by hand`);
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  console.log(
    "Reminder: compare summaries and prerequisite text with the page by hand; do not copy runs of 12 or more words.",
  );
}

export function cliVceValidate(): void {
  const r = readVceFiles(dataDir());
  if (r.errors.length) fail(r.errors);
  console.log(
    `ok: ${r.data.keyDates.length} admissions years, ${r.data.preferenceRules.length} preference rules, ${r.data.earlyEntry.length} schemes, ${r.data.scaling.length} scaling tables, ${r.data.groupings.length} groupings (scaling and groupings come from data/local until VTAC permission is recorded)`,
  );
}

export async function cliVceLoad(): Promise<void> {
  const r = readVceFiles(dataDir());
  if (r.errors.length) fail(r.errors);
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    await loadVce(db, r.data, sha());
    console.log("Loaded VCE admissions data.");
  } finally {
    await db.close();
  }
}

/** courses:match-standins --cricos FILE [--course-locations FILE] [--json]: proposes CRICOS codes for stand-in rows; changes nothing. */
export function cliCoursesMatchStandins(args: string[]): void {
  const { files, errors } = readProviderFiles(dataDir());
  if (errors.length) fail(errors);
  const f = arg(args, "--cricos");
  if (!f) fail(["--cricos FILE.csv is required"]);
  const loc = arg(args, "--course-locations");
  const r = parseCricos(
    readFileSync(f, "utf8"),
    loc ? readFileSync(loc, "utf8") : undefined,
  );
  if (r.problems.length) fail(r.problems.map((p) => `CRICOS file: ${p}`));
  const m = matchStandins(files, r.courses);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ summary: standinSummary(m), matches: m }, null, 2));
    return;
  }
  console.log(JSON.stringify(standinSummary(m)));
  for (const x of m) {
    console.log(`${x.status.padEnd(9)} ${x.courseId}  "${x.name}"`);
    for (const c of x.candidates)
      console.log(
        `            ${c.cricosCode}  ${c.name}  [${c.locations.slice(0, 3).join("; ")}${c.locations.length > 3 ? "; ..." : ""}]`,
      );
  }
  console.log(
    "Nothing was changed. Check campus and year, then set cricosCode on the stand-in in its YAML file.",
  );
}
