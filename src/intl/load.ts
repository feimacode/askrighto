/** Loading and reading the international course store. A load replaces every row in one transaction. */
import { createHash } from "node:crypto";
import type { Db } from "../energy/db.js";
import type { IntlParseReport } from "./parse.js";
import type {
  IntlCourse,
  IntlData,
  IntlProvider,
  IntlSource,
  LevelGroup,
} from "./types.js";

export class NoIntlLoad extends Error {
  constructor() {
    super("no international course load yet");
  }
}

export interface IntlLoadInput {
  providers: IntlProvider[];
  courses: IntlCourse[];
  sourceFile: string;
  sourceDate: string; // YYYY-MM-DD
  report: IntlParseReport;
  gitSha?: string;
}

export async function loadIntl(
  db: Db,
  input: IntlLoadInput,
): Promise<{ rows: number }> {
  if (input.courses.length === 0)
    throw new Error("refusing to load an empty course list");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate))
    throw new Error("source date must be YYYY-MM-DD");
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL search_path TO ${db.schema}`);
    await c.query("DELETE FROM intl_course_locations");
    await c.query("DELETE FROM intl_courses");
    await c.query("DELETE FROM intl_providers");
    for (const p of input.providers)
      await c.query(
        "INSERT INTO intl_providers (id, name, website) VALUES ($1,$2,$3)",
        [p.id, p.name, p.website ?? null],
      );
    for (const x of input.courses) {
      await c.query(
        `INSERT INTO intl_courses (cricos_code, provider_id, name, level, level_group, field, duration_weeks,
           tuition_fee_total, non_tuition_fee, language, work_component, expired)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          x.cricosCode,
          x.providerId,
          x.name,
          x.level,
          x.levelGroup,
          x.field ?? null,
          x.durationWeeks ?? null,
          x.tuitionFeeTotal ?? null,
          x.nonTuitionFee ?? null,
          x.language ?? null,
          x.workComponent ?? null,
          x.expired,
        ],
      );
      const seen = new Set<string>();
      for (const l of x.locations) {
        const k = `${l.state}|${l.campus}`;
        if (seen.has(k)) continue;
        seen.add(k);
        await c.query(
          "INSERT INTO intl_course_locations (cricos_code, state, campus) VALUES ($1,$2,$3)",
          [x.cricosCode, l.state, l.campus],
        );
      }
    }
    await c.query(
      "INSERT INTO intl_loads (source_file, source_date, git_sha, row_count, report) VALUES ($1,$2,$3,$4,$5)",
      [
        input.sourceFile,
        input.sourceDate,
        input.gitSha ?? null,
        input.courses.length,
        JSON.stringify(input.report),
      ],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  return { rows: input.courses.length };
}

/** A short digest of the loaded content, for logs. */
export const digest = (courses: IntlCourse[]) =>
  createHash("sha256")
    .update(JSON.stringify(courses))
    .digest("hex")
    .slice(0, 12);

export class IntlStore implements IntlSource {
  private cached: { at: number; data: IntlData } | undefined;
  constructor(
    private db: Db,
    private ttlMs = 5 * 60_000,
  ) {}
  clear(): void {
    this.cached = undefined;
  }
  async data(): Promise<IntlData> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs)
      return this.cached.data;
    const q = this.db.pool;
    const [prov, courses, locs, load] = await Promise.all([
      q.query("SELECT * FROM intl_providers ORDER BY name"),
      q.query(
        `SELECT i.*, (SELECT c.id FROM courses c WHERE c.cricos_code = i.cricos_code LIMIT 1) AS domestic_id
         FROM intl_courses i ORDER BY i.name, i.cricos_code`,
      ),
      q.query("SELECT * FROM intl_course_locations ORDER BY state, campus"),
      q.query(
        "SELECT loaded_at, source_file, to_char(source_date,'YYYY-MM-DD') AS source_date FROM intl_loads ORDER BY id DESC LIMIT 1",
      ),
    ]);
    if (!load.rows[0]) throw new NoIntlLoad();
    const byCourse = new Map<string, { state: string; campus: string }[]>();
    for (const l of locs.rows)
      byCourse.set(l.cricos_code, [
        ...(byCourse.get(l.cricos_code) ?? []),
        { state: l.state, campus: l.campus },
      ]);
    const data: IntlData = {
      providers: prov.rows.map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.website ? { website: p.website } : {}),
      })),
      courses: courses.rows.map(
        (r): IntlCourse => ({
          cricosCode: r.cricos_code,
          providerId: r.provider_id,
          name: r.name,
          level: r.level,
          levelGroup: r.level_group as LevelGroup,
          ...(r.field ? { field: r.field } : {}),
          ...(r.duration_weeks !== null
            ? { durationWeeks: Number(r.duration_weeks) }
            : {}),
          ...(r.tuition_fee_total !== null
            ? { tuitionFeeTotal: Number(r.tuition_fee_total) }
            : {}),
          ...(r.non_tuition_fee !== null
            ? { nonTuitionFee: Number(r.non_tuition_fee) }
            : {}),
          ...(r.language ? { language: r.language } : {}),
          ...(r.work_component !== null
            ? { workComponent: Boolean(r.work_component) }
            : {}),
          expired: Boolean(r.expired),
          locations: byCourse.get(r.cricos_code) ?? [],
          ...(r.domestic_id ? { domesticCourseId: r.domestic_id } : {}),
        }),
      ),
      sourceDate: new Date(`${load.rows[0].source_date}T00:00:00Z`),
      sourceFile: load.rows[0].source_file,
      loadedAt: load.rows[0].loaded_at,
    };
    this.cached = { at: Date.now(), data };
    return data;
  }
}
