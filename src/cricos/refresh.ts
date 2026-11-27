/**
 * Fetches the CRICOS dataset from data.gov.au and loads the domestic index and the international store from it.
 * Nothing touches disk. Everything is parsed and checked before the first write; the international store is
 * loaded last because its load record is the marker that says the data is current.
 */
import type { Db } from "../energy/db.js";
import { parseCricos, type CricosCourse } from "../courses/cricos.js";
import { loadCourses, mergeIndex, readProviderFiles } from "../courses/load.js";
import { dataDir } from "../courses/data-dir.js";
import { loadIntl } from "../intl/load.js";
import { parseIntlCricos } from "../intl/parse.js";
import { checkGuards } from "./guards.js";
import {
  CricosSourceError,
  downloadCricos,
  findCricosSource,
  type FetchLike,
} from "./source.js";

export interface RefreshOptions {
  db: Db;
  fetch: FetchLike;
  force?: boolean;
  dryRun?: boolean;
  /** Where data/ lives (course YAML). Defaults to ASKRIGHTO_DATA_DIR or ./data. */
  dir?: string;
  /** Test hook: lowers the floor for kept international courses. */
  minIntlCourses?: number;
  log?: (m: string) => void;
}

export type RefreshResult =
  | { status: "locked" }
  | { status: "aborted"; reasons: string[] }
  | {
      status: "unchanged";
      sourceDate: string;
      domestic: "reloaded" | "no_change" | "skipped";
      domesticCourses?: number;
    }
  | {
      status: "loaded" | "dry_run";
      sourceDate: string;
      international: { courses: number; providers: number };
      domesticCourses: number;
      overridden: string[];
    };

const lockKey = (schema: string) => `askrighto-cricos:${schema}`;

export async function refreshCricos(o: RefreshOptions): Promise<RefreshResult> {
  const conn = await o.db.pool.connect();
  try {
    const got = (
      await conn.query("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [
        lockKey(o.db.schema),
      ])
    ).rows[0].ok as boolean;
    if (!got) {
      o.log?.("another instance is refreshing CRICOS; skipping");
      return { status: "locked" };
    }
    try {
      return await doRefresh(o);
    } finally {
      await conn.query("SELECT pg_advisory_unlock(hashtext($1))", [
        lockKey(o.db.schema),
      ]);
    }
  } finally {
    conn.release();
  }
}

async function lastIntl(db: Db) {
  const r = await db.pool.query(
    "SELECT row_count, source_date::text AS source_date, report FROM intl_loads ORDER BY id DESC LIMIT 1",
  );
  const row = r.rows[0];
  if (!row) return undefined;
  return {
    kept: Number(row.row_count),
    sourceDate: String(row.source_date).slice(0, 10),
    fingerprint: (row.report?.fingerprint as string | undefined) ?? undefined,
    contentHash: (row.report?.contentHash as string | undefined) ?? undefined,
  };
}
async function lastDomesticCount(db: Db): Promise<number | undefined> {
  const r = await db.pool.query(
    "SELECT course_count FROM course_loads ORDER BY id DESC LIMIT 1",
  );
  return r.rows[0] ? Number(r.rows[0].course_count) : undefined;
}
async function storedCricos(db: Db): Promise<CricosCourse[]> {
  const r = await db.pool.query(
    "SELECT cricos_code, provider_code, provider_name, course_name, level, duration_weeks, locations FROM cricos_raw",
  );
  return r.rows.map((x) => ({
    cricosCode: x.cricos_code,
    providerCode: x.provider_code,
    ...(x.provider_name ? { providerName: x.provider_name } : {}),
    courseName: x.course_name,
    ...(x.level ? { level: x.level } : {}),
    ...(x.duration_weeks !== null ? { durationWeeks: Number(x.duration_weeks) } : {}),
    locations: x.locations ?? [],
  }));
}

function yamlFiles(dir: string) {
  const r = readProviderFiles(dir);
  if (r.errors.length)
    throw new CricosSourceError(`course files are invalid: ${r.errors.slice(0, 3).join("; ")}`);
  return r.files;
}

async function doRefresh(o: RefreshOptions): Promise<RefreshResult> {
  const log = o.log ?? (() => {});
  const dir = o.dir ?? dataDir();
  try {
    const src = await findCricosSource(o.fetch);
    const prev = await lastIntl(o.db);
    log(`dataset file dated ${src.sourceDate}; last load ${prev?.sourceDate ?? "none"}`);

    // Unchanged at data.gov.au: nothing to download. A deploy may still have changed the course files.
    if (!o.force && prev?.fingerprint === src.fingerprint) {
      const cricos = await storedCricos(o.db);
      if (cricos.length === 0)
        return { status: "unchanged", sourceDate: src.sourceDate, domestic: "skipped" };
      const merged = mergeIndex(yamlFiles(dir), cricos);
      if (o.dryRun)
        return { status: "unchanged", sourceDate: src.sourceDate, domestic: "no_change", domesticCourses: merged.report.courses };
      const r = await loadCourses(o.db, merged, { cricos });
      return {
        status: "unchanged",
        sourceDate: src.sourceDate,
        domestic: r.changed ? "reloaded" : "no_change",
        domesticCourses: merged.report.courses,
      };
    }

    const files = await downloadCricos(o.fetch, src);
    log("downloaded the three CRICOS files");
    if (!o.force && prev?.contentHash === files.contentHash) {
      log("content identical to the last load; nothing to do");
      return { status: "unchanged", sourceDate: src.sourceDate, domestic: "no_change" };
    }

    const intl = parseIntlCricos(files.courses, {
      courseLocationsCsv: files.courseLocations,
      institutionsCsv: files.institutions,
    });
    const dom = parseCricos(files.courses, files.courseLocations);
    const merged = intl.problems.length || dom.problems.length
      ? undefined
      : mergeIndex(yamlFiles(dir), dom.courses);
    const prevDomestic = await lastDomesticCount(o.db);
    const guard = checkGuards({
      problems: [...intl.problems, ...dom.problems],
      newIntlKept: intl.courses.length,
      ...(prev ? { prevIntlKept: prev.kept, prevSourceDate: prev.sourceDate } : {}),
      newDomesticCourses: merged?.report.courses ?? 0,
      ...(prevDomestic !== undefined ? { prevDomesticCourses: prevDomestic } : {}),
      newSourceDate: src.sourceDate,
      ...(o.minIntlCourses !== undefined ? { minIntlCourses: o.minIntlCourses } : {}),
      ...(o.force ? { force: true } : {}),
    });
    if (!guard.ok || !merged) {
      log(`aborted: ${guard.failures.join("; ")}`);
      return { status: "aborted", reasons: guard.failures };
    }
    const summary = {
      sourceDate: src.sourceDate,
      international: { courses: intl.courses.length, providers: intl.providers.length },
      domesticCourses: merged.report.courses,
      overridden: guard.overridden,
    };
    if (o.dryRun) return { status: "dry_run", ...summary };

    await loadCourses(o.db, merged, { cricos: dom.courses });
    await loadIntl(o.db, {
      providers: intl.providers,
      courses: intl.courses,
      sourceFile: "CRICOS CSV resources on data.gov.au",
      sourceDate: src.sourceDate,
      report: {
        ...intl.report,
        fingerprint: src.fingerprint,
        contentHash: files.contentHash,
        via: "cricos:refresh",
      } as typeof intl.report,
    });
    log(`loaded ${intl.courses.length} international and ${merged.report.courses} domestic courses`);
    return { status: "loaded", ...summary };
  } catch (e) {
    if (e instanceof CricosSourceError) return { status: "aborted", reasons: [e.message] };
    throw e;
  }
}
