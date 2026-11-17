/** Loading and reading the career outcomes store. A load replaces every row in one transaction. */
import type { Db } from "../energy/db.js";
import type { CareerParseReport } from "./parse.js";
import type { CareerData, CareerSource, Occupation } from "./types.js";

export class NoCareerLoad extends Error {
  constructor() {
    super("no career outcomes load yet");
  }
}

export interface CareerLoadInput {
  occupations: Occupation[];
  baselineLabel: string;
  midLabel: string;
  endLabel: string;
  classification: string;
  sourceFile: string;
  sourceDate: string; // YYYY-MM-DD
  fileHash: string;
  report: CareerParseReport;
  gitSha?: string;
}

const COLS = [
  "code", "level", "nfd", "name", "skill_level", "baseline_k", "proj_mid_k", "proj_end_k",
  "change5_k", "change5_pct", "change10_k", "change10_pct",
] as const;

const rowOf = (o: Occupation): unknown[] => [
  o.code, o.level, o.nfd, o.name, o.skillLevel ?? null, o.baselineK ?? null, o.midK ?? null, o.endK ?? null,
  o.change5K ?? null, o.change5Pct ?? null, o.change10K ?? null, o.change10Pct ?? null,
];

export async function loadCareers(db: Db, input: CareerLoadInput): Promise<{ rows: number }> {
  if (input.occupations.length === 0) throw new Error("refusing to load an empty occupation list");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate)) throw new Error("source date must be YYYY-MM-DD");
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL search_path TO ${db.schema}`);
    await c.query("DELETE FROM career_occupations");
    const rows = input.occupations.map(rowOf);
    const values = rows.map((_, r) => `(${COLS.map((_k, k) => `$${r * COLS.length + k + 1}`).join(",")})`).join(",");
    await c.query(`INSERT INTO career_occupations (${COLS.join(",")}) VALUES ${values}`, rows.flat());
    await c.query(
      "INSERT INTO career_loads (source_file, source_date, file_hash, git_sha, row_count, baseline_label, mid_label, end_label, classification, report) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        input.sourceFile, input.sourceDate, input.fileHash, input.gitSha ?? null, input.occupations.length,
        input.baselineLabel, input.midLabel, input.endLabel, input.classification, JSON.stringify(input.report),
      ],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  return { rows: input.occupations.length };
}

export class CareerStore implements CareerSource {
  private cached: { at: number; data: CareerData } | undefined;
  constructor(
    private db: Db,
    private ttlMs = 5 * 60_000,
  ) {}
  clear(): void {
    this.cached = undefined;
  }
  async data(): Promise<CareerData> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs) return this.cached.data;
    const [occ, load] = await Promise.all([
      this.db.pool.query("SELECT * FROM career_occupations ORDER BY level, code, nfd"),
      this.db.pool.query(
        "SELECT loaded_at, source_file, baseline_label, mid_label, end_label, classification, to_char(source_date,'YYYY-MM-DD') AS source_date FROM career_loads ORDER BY id DESC LIMIT 1",
      ),
    ]);
    if (!load.rows[0]) throw new NoCareerLoad();
    const n = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
    const opt = <K extends string>(k: K, v: number | undefined) => (v === undefined ? {} : { [k]: v });
    const data: CareerData = {
      occupations: occ.rows.map(
        (r): Occupation => ({
          code: r.code,
          level: Number(r.level) as Occupation["level"],
          nfd: r.nfd === true,
          name: r.name,
          ...(r.skill_level ? { skillLevel: r.skill_level as string } : {}),
          ...opt("baselineK", n(r.baseline_k)),
          ...opt("midK", n(r.proj_mid_k)),
          ...opt("endK", n(r.proj_end_k)),
          ...opt("change5K", n(r.change5_k)),
          ...opt("change5Pct", n(r.change5_pct)),
          ...opt("change10K", n(r.change10_k)),
          ...opt("change10Pct", n(r.change10_pct)),
        }),
      ),
      baselineLabel: load.rows[0].baseline_label,
      midLabel: load.rows[0].mid_label,
      endLabel: load.rows[0].end_label,
      classification: load.rows[0].classification,
      sourceDate: new Date(`${load.rows[0].source_date}T00:00:00Z`),
      sourceFile: load.rows[0].source_file,
      loadedAt: load.rows[0].loaded_at,
    };
    this.cached = { at: Date.now(), data };
    return data;
  }
}
