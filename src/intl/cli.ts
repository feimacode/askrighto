/** Command-line entry points: intl:validate, intl:load. Both need a CRICOS course sheet exported to CSV. */
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { loadIntl } from "./load.js";
import { parseIntlCricos } from "./parse.js";

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
function parseFile(args: string[]) {
  const f = arg(args, "--cricos");
  if (!f)
    throw new Error(
      "Give the CRICOS Courses sheet as CSV: --cricos FILE.csv (and, for locations and websites, --course-locations FILE.csv --institutions FILE.csv)",
    );
  const opt = (name: string) => {
    const p = arg(args, name);
    return p ? readFileSync(p, "utf8") : undefined;
  };
  const courseLocationsCsv = opt("--course-locations");
  const institutionsCsv = opt("--institutions");
  const r = parseIntlCricos(readFileSync(f, "utf8"), {
    ...(courseLocationsCsv ? { courseLocationsCsv } : {}),
    ...(institutionsCsv ? { institutionsCsv } : {}),
  });
  if (r.problems.length) {
    for (const p of r.problems) console.error(`error: CRICOS file: ${p}`);
    process.exit(1);
  }
  return { file: f, ...r };
}
const print = (r: ReturnType<typeof parseFile>) => {
  console.log(JSON.stringify(r.report, null, 2));
  if (r.report.columnsMissing.length)
    console.log(
      `note: no column found for ${r.report.columnsMissing.join(", ")}; those facts will show as not published`,
    );
};

export function cliIntlValidate(args: string[]): void {
  const r = parseFile(args);
  console.log(
    `ok: ${r.report.kept} courses from ${r.providers.length} providers kept of ${r.report.rowsRead} rows`,
  );
  print(r);
}

export async function cliIntlLoad(args: string[]): Promise<void> {
  const r = parseFile(args);
  // The register's own file date matters (it is shown as the as-of date), so it is given, not guessed.
  const sourceDate =
    arg(args, "--source-date") ??
    statSync(r.file).mtime.toISOString().slice(0, 10);
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    await loadIntl(db, {
      providers: r.providers,
      courses: r.courses,
      sourceFile: basename(r.file),
      sourceDate,
      report: r.report,
      ...(sha() ? { gitSha: sha() } : {}),
    });
    console.log(
      `Loaded ${r.courses.length} courses (file dated ${sourceDate}).`,
    );
    print(r);
  } finally {
    await db.close();
  }
}
