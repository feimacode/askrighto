/** Building the CRICOS course index for each provider and loading it into PostgreSQL in one transaction. */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../energy/db.js";
import type { Catalogue, CatalogueSource } from "./catalogue.js";
import { isUndergraduate, type CricosCourse } from "./cricos.js";
import { dataDir } from "./data-dir.js";
import type { Course, Provider, ProviderFile, Region } from "./types.js";
import { REGIONS } from "./types.js";
import { parseProviderFile } from "./validate.js";

export interface LoadReport {
  courses: number;
  byProvider: Record<string, number>;
  warnings: string[];
  hash: string;
}

export function readProviderFiles(dir = dataDir()): {
  files: ProviderFile[];
  errors: string[];
} {
  const root = join(dir, "courses");
  const files: ProviderFile[] = [];
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const region of readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()) {
    if (!(REGIONS as readonly string[]).includes(region)) {
      errors.push(
        `data/courses/${region}: not a known region (${REGIONS.join(", ")})`,
      );
      continue;
    }
    const base = join(root, region);
    for (const f of readdirSync(base)
      .filter((x) => x.endsWith(".yaml"))
      .sort()) {
      const r = parseProviderFile(readFileSync(join(base, f), "utf8"), {
        file: `${region}/${f}`,
      });
      errors.push(...r.errors);
      if (r.file) {
        const prev = seen.get(r.file.provider.id);
        if (prev)
          errors.push(
            `${region}/${f}: provider id "${r.file.provider.id}" is already used by ${prev}`,
          );
        seen.set(r.file.provider.id, `${region}/${f}`);
        r.file.provider.region = region as Region;
        files.push(r.file);
      }
    }
  }
  return { files, errors };
}

/** Builds the index: every undergraduate CRICOS row of each provider with a CRICOS provider code. Pure: no database. */
export function mergeIndex(
  files: readonly ProviderFile[],
  cricos: readonly CricosCourse[] = [],
): { providers: Provider[]; courses: Course[]; report: LoadReport } {
  const warnings: string[] = [];
  const out: Course[] = [];
  const ids = new Set<string>();
  for (const f of files) {
    const pCode = f.provider.cricosProviderCode;
    if (!pCode) {
      warnings.push(`${f.provider.id}: no CRICOS provider code, so no rows`);
      continue;
    }
    for (const hit of cricos) {
      if (hit.providerCode !== pCode || !isUndergraduate(hit.level)) continue;
      const id = `${f.provider.id}-cricos-${hit.cricosCode.toLowerCase()}`;
      if (ids.has(id)) continue;
      ids.add(id);
      out.push({
        id,
        providerId: f.provider.id,
        name: hit.courseName,
        level: "bachelor",
        campuses: hit.locations,
        ...(hit.durationWeeks
          ? { durationYears: Math.round((hit.durationWeeks / 52) * 100) / 100 }
          : {}),
        cricosCode: hit.cricosCode,
      });
    }
  }
  const byProvider = out.reduce<Record<string, number>>(
    (m, c) => ((m[c.providerId] = (m[c.providerId] ?? 0) + 1), m),
    {},
  );
  const hash = createHash("sha256")
    .update(JSON.stringify(out))
    .digest("hex")
    .slice(0, 16);
  return {
    providers: files.map((f) => f.provider),
    courses: out,
    report: { courses: out.length, byProvider, warnings, hash },
  };
}

/** Replaces the course tables with the index in one transaction. A second load of the same content changes nothing. */
export async function loadCourses(
  db: Db,
  merged: ReturnType<typeof mergeIndex>,
  opts: { gitSha?: string; cricos?: readonly CricosCourse[] } = {},
): Promise<{ changed: boolean; report: LoadReport }> {
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    const last = await c.query<{ report: LoadReport }>(
      "SELECT report FROM course_loads ORDER BY id DESC LIMIT 1",
    );
    if (last.rows[0]?.report?.hash === merged.report.hash) {
      await c.query("ROLLBACK");
      return { changed: false, report: merged.report };
    }
    await c.query(
      "DELETE FROM course_campuses; DELETE FROM courses; DELETE FROM providers",
    );
    for (const p of merged.providers) {
      await c.query(
        "INSERT INTO providers (id, name, courses_url, search_url, cricos_provider_code, region) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          p.id,
          p.name,
          p.coursesUrl,
          p.searchUrl ?? null,
          p.cricosProviderCode ?? null,
          p.region ?? "vic",
        ],
      );
    }
    for (const x of merged.courses) {
      await c.query(
        `INSERT INTO courses (id, provider_id, origin, depth, name, level, duration_years, cricos_code, from_cricos)
         VALUES ($1,$2,'cricos','index_only',$3,$4,$5,$6,true)`,
        [x.id, x.providerId, x.name, x.level, x.durationYears ?? null, x.cricosCode],
      );
      for (const campus of x.campuses)
        await c.query(
          "INSERT INTO course_campuses (course_id, campus) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [x.id, campus],
        );
    }
    if (opts.cricos?.length) {
      await c.query("DELETE FROM cricos_raw");
      for (const r of opts.cricos) {
        await c.query(
          "INSERT INTO cricos_raw (cricos_code, provider_code, provider_name, course_name, level, duration_weeks, locations) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
          [
            r.cricosCode,
            r.providerCode,
            r.providerName ?? null,
            r.courseName,
            r.level ?? null,
            r.durationWeeks ?? null,
            r.locations,
          ],
        );
      }
    }
    await c.query(
      "INSERT INTO course_loads (git_sha, course_count, figure_count, report) VALUES ($1,$2,0,$3)",
      [opts.gitSha ?? null, merged.report.courses, JSON.stringify(merged.report)],
    );
    await c.query("COMMIT");
    return { changed: true, report: merged.report };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Reads the loaded set from PostgreSQL, cached briefly. */
export class CourseStore implements CatalogueSource {
  private cached: { at: number; cat: Catalogue } | undefined;
  constructor(
    private db: Db,
    private ttlMs = 5 * 60_000,
  ) {}
  clear(): void {
    this.cached = undefined;
  }
  async catalogue(): Promise<Catalogue> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs)
      return this.cached.cat;
    const q = this.db.pool;
    const [prov, courses, camp, load] = await Promise.all([
      q.query("SELECT * FROM providers ORDER BY name"),
      q.query("SELECT * FROM courses ORDER BY name"),
      q.query("SELECT * FROM course_campuses ORDER BY campus"),
      q.query("SELECT loaded_at FROM course_loads ORDER BY id DESC LIMIT 1"),
    ]);
    if (!load.rows[0]) throw new NoCourseLoad();
    const campuses = new Map<string, string[]>();
    for (const r of camp.rows)
      campuses.set(r.course_id, [...(campuses.get(r.course_id) ?? []), r.campus]);
    const cat: Catalogue = {
      providers: prov.rows.map((p) => ({
        id: p.id,
        name: p.name,
        coursesUrl: p.courses_url,
        domains: [],
        region: p.region,
        ...(p.search_url ? { searchUrl: p.search_url } : {}),
      })),
      courses: courses.rows.map(
        (r): Course => ({
          id: r.id,
          providerId: r.provider_id,
          name: r.name,
          level: r.level,
          campuses: campuses.get(r.id) ?? [],
          ...(r.duration_years !== null
            ? { durationYears: Number(r.duration_years) }
            : {}),
          cricosCode: r.cricos_code,
        }),
      ),
      loadedAt: load.rows[0].loaded_at,
    };
    this.cached = { at: Date.now(), cat };
    return cat;
  }
}

export class NoCourseLoad extends Error {
  constructor() {
    super("no course load recorded");
  }
}
