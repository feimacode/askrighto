/** Command-line entry points: cricos:refresh and load-all. */
import { createDb, dbConfig, migrate } from "../energy/db.js";
import { refreshCricos, type RefreshResult } from "./refresh.js";

function describe(r: RefreshResult): string {
  switch (r.status) {
    case "locked":
      return "Another instance is refreshing CRICOS; nothing done.";
    case "aborted":
      return `Aborted, stored data unchanged:\n- ${r.reasons.join("\n- ")}`;
    case "unchanged":
      return `CRICOS unchanged (file dated ${r.sourceDate}); domestic course files ${r.domestic.replace("_", " ")}${r.domesticCourses ? ` (${r.domesticCourses} courses)` : ""}.`;
    default:
      return `${r.status === "dry_run" ? "Dry run, nothing written. Would load" : "Loaded"} ${r.international.courses} international courses (${r.international.providers} providers) and ${r.domesticCourses} domestic courses; file dated ${r.sourceDate}.${r.overridden.length ? `\nForced past: ${r.overridden.join("; ")}` : ""}`;
  }
}

/** Returns true when the run did not abort. */
export async function cliCricosRefresh(args: string[]): Promise<boolean> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    await migrate(db);
    const r = await refreshCricos({
      db,
      fetch: fetch as never,
      force: args.includes("--force"),
      dryRun: args.includes("--dry-run"),
      log: (m) => console.error(m),
    });
    console.log(describe(r));
    return r.status !== "aborted";
  } finally {
    await db.close();
  }
}

/** migrate, then the CRICOS refresh: one command for a fresh database. */
export async function cliLoadAll(args: string[]): Promise<boolean> {
  return cliCricosRefresh(args);
}
