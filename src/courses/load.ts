/** Merging CRICOS rows with the YAML files, and loading the result into PostgreSQL in one transaction. */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../energy/db.js";
import type { Catalogue, CatalogueSource } from "./catalogue.js";
import { isUndergraduate, type CricosCourse } from "./cricos.js";
import type {
  Course,
  EntryFigure,
  PrerequisiteBlock,
  Provider,
  ProviderFile,
  Region,
} from "./types.js";
import { REGIONS } from "./types.js";
import { dataDir, loadStudies } from "./studies.js";
import { parseProviderFile } from "./validate.js";

export interface LoadReport {
  courses: number;
  figures: number;
  byOrigin: Record<string, number>;
  byDepth: Record<string, number>;
  withoutOfficialLink: string[];
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
  const studies = loadStudies(dir);
  const seen = new Map<string, string>();
  for (const region of readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()) {
    if (!(REGIONS as readonly string[]).includes(region)) {
      errors.push(`data/courses/${region}: not a known region (${REGIONS.join(", ")})`);
      continue;
    }
    const base = join(root, region);
    for (const f of readdirSync(base)
      .filter((x) => x.endsWith(".yaml"))
      .sort()) {
      const r = parseProviderFile(readFileSync(join(base, f), "utf8"), {
        file: `${region}/${f}`,
        studies,
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

/** Merges the YAML rows with CRICOS rows (if any). Pure: no database. */
export function mergeIndex(
  files: readonly ProviderFile[],
  cricos: readonly CricosCourse[] = [],
): { providers: Provider[]; courses: Course[]; report: LoadReport } {
  const warnings: string[] = [];
  const byCode = new Map(cricos.map((c) => [c.cricosCode, c]));
  const out: Course[] = [];
  const ids = new Set<string>();
  for (const f of files) {
    const pCode = (f.provider as Provider & { cricosProviderCode?: string })
      .cricosProviderCode;
    const used = new Set<string>();
    for (const c of f.courses) {
      if (ids.has(c.id)) {
        warnings.push(
          `${c.id}: duplicate course id across files, kept the first`,
        );
        continue;
      }
      ids.add(c.id);
      let course = c;
      if (c.cricosCode && cricos.length) {
        const hit = byCode.get(c.cricosCode);
        if (!hit) {
          warnings.push(
            `${c.id}: CRICOS code ${c.cricosCode} is not in the CRICOS file`,
          );
          if (c.origin === "cricos" && c.depth === "index_only") continue; // left CRICOS and nothing curated keeps it
        } else {
          used.add(hit.cricosCode);
          course = {
            ...c,
            fromCricos: true,
            name: c.depth === "curated" ? c.name : hit.courseName,
            ...(c.durationYears === undefined && hit.durationWeeks
              ? {
                  durationYears:
                    Math.round((hit.durationWeeks / 52) * 100) / 100,
                }
              : {}),
            ...(c.campuses.length === 0 ? { campuses: hit.locations } : {}),
          };
          if (c.depth === "curated" && norm(hit.courseName) !== norm(c.name))
            warnings.push(
              `${c.id}: name "${c.name}" differs from CRICOS "${hit.courseName}"`,
            );
        }
      }
      out.push(course);
    }
    if (pCode) {
      for (const hit of cricos) {
        if (
          hit.providerCode !== pCode ||
          used.has(hit.cricosCode) ||
          !isUndergraduate(hit.level)
        )
          continue;
        const id = `${f.provider.id}-cricos-${hit.cricosCode.toLowerCase()}`;
        if (ids.has(id)) continue;
        if (
          out.some(
            (x) =>
              x.providerId === f.provider.id && x.cricosCode === hit.cricosCode,
          )
        )
          continue;
        ids.add(id);
        out.push({
          id,
          providerId: f.provider.id,
          origin: "cricos",
          depth: "index_only",
          name: hit.courseName,
          level: "bachelor",
          fields: [],
          campuses: hit.locations,
          ...(hit.durationWeeks
            ? {
                durationYears: Math.round((hit.durationWeeks / 52) * 100) / 100,
              }
            : {}),
          cricosCode: hit.cricosCode,
          fromCricos: true,
          entryFigures: [],
          prerequisites: [],
          otherCriteria: [],
        });
      }
    }
  }
  const tally = (key: "origin" | "depth") =>
    out.reduce<Record<string, number>>(
      (m, c) => ((m[c[key]] = (m[c[key]] ?? 0) + 1), m),
      {},
    );
  const hash = createHash("sha256")
    .update(JSON.stringify(out))
    .digest("hex")
    .slice(0, 16);
  return {
    providers: files.map((f) => f.provider),
    courses: out,
    report: {
      courses: out.length,
      figures: out.reduce((n, c) => n + c.entryFigures.length, 0),
      byOrigin: tally("origin"),
      byDepth: tally("depth"),
      withoutOfficialLink: out.filter((c) => !c.officialUrl).map((c) => c.id),
      warnings,
      hash,
    },
  };
}
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Replaces the course tables with the merged set in one transaction. A second load of the same content changes nothing. */
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
      "DELETE FROM course_campuses; DELETE FROM course_admissions; DELETE FROM course_entry_figures; DELETE FROM course_prerequisites; DELETE FROM courses; DELETE FROM providers",
    );
    for (const p of merged.providers as Array<
      Provider & { cricosProviderCode?: string }
    >) {
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
        `INSERT INTO courses (id, provider_id, origin, depth, name, level, fields, duration_years, cricos_code, vtac_code, official_url, course_seeker_url, found_at, summary, checked_on, checked_by, other_criteria, from_cricos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          x.id,
          x.providerId,
          x.origin,
          x.depth,
          x.name,
          x.level,
          x.fields,
          x.durationYears ?? null,
          x.cricosCode ?? null,
          x.vtacCode ?? null,
          x.officialUrl ?? null,
          x.courseSeekerUrl ?? null,
          x.foundAt ?? null,
          x.summary ?? null,
          x.checkedOn ?? null,
          x.checkedBy ?? null,
          JSON.stringify(x.otherCriteria),
          x.fromCricos ?? false,
        ],
      );
      for (const a of x.admissions ?? [])
        await c.query(
          "INSERT INTO course_admissions (course_id, centre, code) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [x.id, a.centre, a.code],
        );
      for (const campus of x.campuses)
        await c.query(
          "INSERT INTO course_campuses (course_id, campus) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [x.id, campus],
        );
      for (const f of x.entryFigures) {
        await c.query(
          "INSERT INTO course_entry_figures (course_id, kind, value, intake_year, campus, source_url, checked_on) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [
            x.id,
            f.kind,
            f.value,
            f.intakeYear,
            f.campus ?? "",
            f.sourceUrl,
            f.checkedOn,
          ],
        );
      }
      for (const p of x.prerequisites) {
        await c.query(
          "INSERT INTO course_prerequisites (course_id, applies_to_year, text, rules, source_url, checked_on) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            x.id,
            p.appliesToYear,
            p.text,
            JSON.stringify(p.rules),
            p.sourceUrl,
            p.checkedOn,
          ],
        );
      }
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
      "INSERT INTO course_loads (git_sha, course_count, figure_count, report) VALUES ($1,$2,$3,$4)",
      [
        opts.gitSha ?? null,
        merged.report.courses,
        merged.report.figures,
        JSON.stringify(merged.report),
      ],
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

const iso = (d: unknown) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d);

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
    const [prov, courses, camp, figs, pre, load, adm] = await Promise.all([
      q.query("SELECT * FROM providers ORDER BY name"),
      q.query("SELECT * FROM courses ORDER BY name"),
      q.query("SELECT * FROM course_campuses ORDER BY campus"),
      q.query(
        "SELECT * FROM course_entry_figures ORDER BY intake_year DESC, kind",
      ),
      q.query(
        "SELECT * FROM course_prerequisites ORDER BY applies_to_year DESC",
      ),
      q.query(
        "SELECT loaded_at, git_sha FROM course_loads ORDER BY id DESC LIMIT 1",
      ),
      q.query("SELECT * FROM course_admissions ORDER BY centre, code"),
    ]);
    if (!load.rows[0]) throw new NoCourseLoad();
    const group = <T extends { course_id: string }>(rows: T[]) =>
      rows.reduce<Map<string, T[]>>(
        (m, r) => (m.set(r.course_id, [...(m.get(r.course_id) ?? []), r]), m),
        new Map(),
      );
    const campuses = group(camp.rows);
    const figures = group(figs.rows);
    const prereqs = group(pre.rows);
    const admissions = group(adm.rows);
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
          origin: r.origin,
          depth: r.depth,
          name: r.name,
          level: r.level,
          fields: r.fields,
          campuses: (campuses.get(r.id) ?? []).map((x) => x.campus as string),
          ...(r.duration_years !== null
            ? { durationYears: Number(r.duration_years) }
            : {}),
          ...(r.cricos_code ? { cricosCode: r.cricos_code } : {}),
          ...(r.vtac_code ? { vtacCode: r.vtac_code } : {}),
          ...((admissions.get(r.id) ?? []).length
            ? {
                admissions: (admissions.get(r.id) ?? []).map((a) => ({
                  centre: a.centre,
                  code: a.code,
                })),
              }
            : {}),
          ...(r.official_url ? { officialUrl: r.official_url } : {}),
          ...(r.course_seeker_url
            ? { courseSeekerUrl: r.course_seeker_url }
            : {}),
          ...(r.found_at ? { foundAt: r.found_at } : {}),
          ...(r.summary ? { summary: r.summary } : {}),
          ...(r.checked_on ? { checkedOn: iso(r.checked_on) } : {}),
          ...(r.checked_by ? { checkedBy: r.checked_by } : {}),
          ...(r.from_cricos ? { fromCricos: true } : {}),
          otherCriteria: r.other_criteria,
          entryFigures: (figures.get(r.id) ?? []).map(
            (f): EntryFigure => ({
              kind: f.kind,
              value: Number(f.value),
              intakeYear: f.intake_year,
              ...(f.campus ? { campus: f.campus } : {}),
              sourceUrl: f.source_url,
              checkedOn: iso(f.checked_on),
            }),
          ),
          prerequisites: (prereqs.get(r.id) ?? []).map(
            (p): PrerequisiteBlock => ({
              appliesToYear: p.applies_to_year,
              text: p.text,
              rules: p.rules,
              sourceUrl: p.source_url,
              checkedOn: iso(p.checked_on),
            }),
          ),
        }),
      ),
      loadedAt: load.rows[0].loaded_at,
      ...(load.rows[0].git_sha ? { gitSha: load.rows[0].git_sha } : {}),
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
