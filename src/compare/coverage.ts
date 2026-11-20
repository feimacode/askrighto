/**
 * Coverage report for the two course use cases (add-course-use-case-comparison). Reads only our own tables,
 * writes nothing, calls no outside service and logs no tool arguments.
 */
import { availability } from "../core/rights.js";
import type { Db } from "../energy/db.js";

export interface Dataset {
  id: string;
  rightsStatus: string;
  /** Whether it would be served if the process ran in production today. */
  productionReady: boolean;
}
export interface Share {
  count: number;
  of: number;
  percent: number | null;
}
export interface DomesticCoverage {
  loaded: boolean;
  courses: number;
  curated: number;
  indexOnly: number;
  with: Record<string, Share>;
  sourceLoadedAt: string | null;
  sourceAgeDays: number | null;
  datasets: Dataset[];
}
export interface IntlCoverage {
  loaded: boolean;
  courses: number;
  providers: number;
  byLevel: Record<string, number>;
  with: Record<string, Share>;
  sourceFile: string | null;
  sourceDate: string | null;
  sourceAgeDays: number | null;
  columnsMissing: string[];
  datasets: Dataset[];
}
export interface CoverageReport {
  generatedAt: string;
  domestic: DomesticCoverage;
  international: IntlCoverage;
}

const PROD = { ASKRIGHTO_ENV: "production" } as NodeJS.ProcessEnv;
export function datasetsFor(ids: string[]): Dataset[] {
  return ids.map((id) => ({
    id,
    rightsStatus: availability(id, PROD).servable
      ? "servable in production"
      : "held back in production",
    productionReady: availability(id, PROD).servable,
  }));
}
const share = (count: number, of: number): Share => ({
  count,
  of,
  percent: of ? Math.round((count / of) * 1000) / 10 : null,
});
const ageDays = (d: Date, now: Date) =>
  Math.floor((now.getTime() - d.getTime()) / 86_400_000);

async function tableExists(db: Db, name: string): Promise<boolean> {
  const r = await db.pool.query("SELECT to_regclass($1) IS NOT NULL AS ok", [
    `${db.schema}.${name}`,
  ]);
  return Boolean(r.rows[0]?.ok);
}
const one = async (db: Db, sql: string): Promise<Record<string, unknown>> =>
  (await db.pool.query(sql)).rows[0] ?? {};

export async function domesticCoverage(
  db: Db,
  now = new Date(),
): Promise<DomesticCoverage> {
  const datasets = datasetsFor([
    "vic-courses",
    "nsw-act-courses",
    "qld-courses",
    "vce-key-dates",
    "vtac-preference-rules",
    "vic-early-entry",
    "vce-scaling",
    "vce-study-groupings",
  ]);
  const empty: DomesticCoverage = {
    loaded: false,
    courses: 0,
    curated: 0,
    indexOnly: 0,
    with: {},
    sourceLoadedAt: null,
    sourceAgeDays: null,
    datasets,
  };
  if (!(await tableExists(db, "courses"))) return empty;
  const t = await one(
    db,
    `SELECT count(*)::int AS n,
       count(*) FILTER (WHERE depth = 'curated')::int AS curated,
       count(*) FILTER (WHERE depth = 'index_only')::int AS index_only,
       count(*) FILTER (WHERE official_url IS NOT NULL)::int AS official,
       count(*) FILTER (WHERE cricos_code IS NOT NULL)::int AS cricos,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM course_entry_figures f WHERE f.course_id = courses.id))::int AS figs,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM course_prerequisites p WHERE p.course_id = courses.id))::int AS prereq
     FROM courses`,
  );
  const load = await one(
    db,
    "SELECT loaded_at FROM course_loads ORDER BY id DESC LIMIT 1",
  );
  const n = Number(t.n ?? 0);
  const at = load.loaded_at instanceof Date ? load.loaded_at : undefined;
  return {
    loaded: n > 0,
    courses: n,
    curated: Number(t.curated ?? 0),
    indexOnly: Number(t.index_only ?? 0),
    with: {
      entryFigure: share(Number(t.figs ?? 0), n),
      prerequisiteRule: share(Number(t.prereq ?? 0), n),
      officialLink: share(Number(t.official ?? 0), n),
      cricosCode: share(Number(t.cricos ?? 0), n),
    },
    sourceLoadedAt: at?.toISOString() ?? null,
    sourceAgeDays: at ? ageDays(at, now) : null,
    datasets,
  };
}

export async function intlCoverage(
  db: Db,
  now = new Date(),
): Promise<IntlCoverage> {
  const datasets = datasetsFor(["intl-courses"]);
  const empty: IntlCoverage = {
    loaded: false,
    courses: 0,
    providers: 0,
    byLevel: {},
    with: {},
    sourceFile: null,
    sourceDate: null,
    sourceAgeDays: null,
    columnsMissing: [],
    datasets,
  };
  if (!(await tableExists(db, "intl_courses"))) return empty;
  const t = await one(
    db,
    `SELECT count(*)::int AS n,
       count(*) FILTER (WHERE tuition_fee_total IS NOT NULL)::int AS fee,
       count(*) FILTER (WHERE duration_weeks IS NOT NULL)::int AS dur,
       count(*) FILTER (WHERE language IS NOT NULL)::int AS lang,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM intl_course_locations l WHERE l.cricos_code = intl_courses.cricos_code))::int AS loc,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM intl_providers p WHERE p.id = provider_id AND p.website IS NOT NULL))::int AS web,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM courses c WHERE c.cricos_code = intl_courses.cricos_code))::int AS dom
     FROM intl_courses`,
  ).catch(() => ({}) as Record<string, unknown>);
  const n = Number(t.n ?? 0);
  const levels = (
    await db.pool.query(
      "SELECT level_group, count(*)::int AS n FROM intl_courses GROUP BY level_group ORDER BY level_group",
    )
  ).rows;
  const prov = await one(db, "SELECT count(*)::int AS n FROM intl_providers");
  const load = await one(
    db,
    "SELECT source_file, to_char(source_date,'YYYY-MM-DD') AS d, report FROM intl_loads ORDER BY id DESC LIMIT 1",
  );
  const src =
    typeof load.d === "string" ? new Date(`${load.d}T00:00:00Z`) : undefined;
  const rep = (load.report ?? {}) as { columnsMissing?: string[] };
  return {
    loaded: n > 0,
    courses: n,
    providers: Number(prov.n ?? 0),
    byLevel: Object.fromEntries(
      levels.map((r) => [r.level_group as string, r.n as number]),
    ),
    with: {
      tuitionFee: share(Number(t.fee ?? 0), n),
      duration: share(Number(t.dur ?? 0), n),
      location: share(Number(t.loc ?? 0), n),
      providerWebsite: share(Number(t.web ?? 0), n),
      language: share(Number(t.lang ?? 0), n),
      inDomesticIndex: share(Number(t.dom ?? 0), n),
    },
    sourceFile: (load.source_file as string | undefined) ?? null,
    sourceDate: src?.toISOString().slice(0, 10) ?? null,
    sourceAgeDays: src ? ageDays(src, now) : null,
    columnsMissing: rep.columnsMissing ?? [],
    datasets,
  };
}

export async function coverageReport(
  db: Db,
  now = new Date(),
): Promise<CoverageReport> {
  return {
    generatedAt: now.toISOString(),
    domestic: await domesticCoverage(db, now),
    international: await intlCoverage(db, now),
  };
}

const pct = (s: Share) => `${s.count} of ${s.of} (${s.percent ?? 0}%)`;
export function formatReport(r: CoverageReport): string {
  const d = r.domestic;
  const i = r.international;
  const ds = (xs: Dataset[]) =>
    xs.map((x) => `  - ${x.id}: ${x.rightsStatus}`).join("\n");
  return [
    `Coverage report, ${r.generatedAt}`,
    "",
    "DOMESTIC (VIC universities, VCE entry)",
    d.loaded
      ? [
          `  courses: ${d.courses} (curated ${d.curated}, index only ${d.indexOnly})`,
          ...Object.entries(d.with).map(([k, v]) => `  with ${k}: ${pct(v)}`),
          `  last load: ${d.sourceLoadedAt} (${d.sourceAgeDays} days ago)`,
        ].join("\n")
      : "  no data loaded",
    "  datasets in production mode:",
    ds(d.datasets),
    "",
    "INTERNATIONAL (CRICOS)",
    i.loaded
      ? [
          `  courses: ${i.courses} from ${i.providers} providers; by level ${JSON.stringify(i.byLevel)}`,
          ...Object.entries(i.with).map(([k, v]) => `  with ${k}: ${pct(v)}`),
          `  source file: ${i.sourceFile}, dated ${i.sourceDate} (${i.sourceAgeDays} days ago)`,
          i.columnsMissing.length
            ? `  columns not found in the file: ${i.columnsMissing.join(", ")}`
            : "  all expected columns found",
        ].join("\n")
      : "  no data loaded",
    "  datasets in production mode:",
    ds(i.datasets),
  ].join("\n");
}
