/** Loading and reading the AER benchmark tables. A load replaces every row in one transaction. */
import type { Db } from "../db.js";
import type { BenchmarkParseReport } from "./parse.js";
import type { BenchmarkData, BenchmarkRow, BenchmarkSource, PostcodeRow, Season } from "./types.js";

export class NoBenchmarkLoad extends Error {
  constructor() {
    super("no energy benchmark load yet");
  }
}

export interface BenchmarkLoadInput {
  rows: BenchmarkRow[];
  postcodes: PostcodeRow[];
  sourceFile: string;
  sourceDate: string; // YYYY-MM-DD
  releaseLabel: string;
  fileHash: string;
  report: BenchmarkParseReport;
  gitSha?: string;
}

const COLS = ["fuel", "zone", "state", "household_size", "season", "value", "unit", "source_sheet"] as const;

export async function loadBenchmarks(db: Db, input: BenchmarkLoadInput): Promise<{ rows: number; postcodes: number }> {
  if (input.rows.length === 0 || input.postcodes.length === 0) throw new Error("refusing to load an empty benchmark set");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate)) throw new Error("source date must be YYYY-MM-DD");
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL search_path TO ${db.schema}`);
    await c.query("DELETE FROM energy_benchmarks");
    await c.query("DELETE FROM energy_benchmark_postcodes");
    // Insert in batches to stay under the parameter limit.
    for (let i = 0; i < input.rows.length; i += 500) {
      const chunk = input.rows.slice(i, i + 500);
      const values = chunk.map((_, r) => `(${COLS.map((_k, k) => `$${r * COLS.length + k + 1}`).join(",")})`).join(",");
      await c.query(
        `INSERT INTO energy_benchmarks (${COLS.join(",")}) VALUES ${values}`,
        chunk.flatMap((r) => [r.fuel, r.zone, r.state, r.size, r.season, r.value, r.unit, r.sheet]),
      );
    }
    for (let i = 0; i < input.postcodes.length; i += 1000) {
      const chunk = input.postcodes.slice(i, i + 1000);
      const values = chunk.map((_, r) => `($${r * 3 + 1},$${r * 3 + 2},$${r * 3 + 3})`).join(",");
      await c.query(
        `INSERT INTO energy_benchmark_postcodes (postcode, climate_zone, sa_zone) VALUES ${values}`,
        chunk.flatMap((p) => [p.postcode, p.climateZone ?? null, p.saZone ?? null]),
      );
    }
    await c.query(
      "INSERT INTO energy_benchmark_load (source_file, source_date, release_label, file_hash, git_sha, benchmark_rows, postcode_rows, report) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [input.sourceFile, input.sourceDate, input.releaseLabel, input.fileHash, input.gitSha ?? null, input.rows.length, input.postcodes.length, JSON.stringify(input.report)],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  return { rows: input.rows.length, postcodes: input.postcodes.length };
}

export class BenchmarkStore implements BenchmarkSource {
  private cached: { at: number; data: BenchmarkData } | undefined;
  constructor(
    private db: Db,
    private ttlMs = 10 * 60_000,
  ) {}
  clear(): void {
    this.cached = undefined;
  }
  async data(): Promise<BenchmarkData> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs) return this.cached.data;
    const [b, p, l] = await Promise.all([
      this.db.pool.query("SELECT * FROM energy_benchmarks ORDER BY fuel, zone, state, household_size, season"),
      this.db.pool.query("SELECT * FROM energy_benchmark_postcodes ORDER BY postcode"),
      this.db.pool.query(
        "SELECT loaded_at, source_file, release_label, to_char(source_date,'YYYY-MM-DD') AS source_date FROM energy_benchmark_load ORDER BY id DESC LIMIT 1",
      ),
    ]);
    if (!l.rows[0]) throw new NoBenchmarkLoad();
    const data: BenchmarkData = {
      rows: b.rows.map(
        (r): BenchmarkRow => ({
          fuel: r.fuel,
          zone: r.zone,
          state: r.state,
          size: Number(r.household_size) as BenchmarkRow["size"],
          season: r.season as Season,
          value: Number(r.value),
          unit: r.unit,
          sheet: r.source_sheet,
        }),
      ),
      postcodes: p.rows.map((r): PostcodeRow => ({
        postcode: r.postcode,
        ...(r.climate_zone !== null ? { climateZone: Number(r.climate_zone) } : {}),
        ...(r.sa_zone ? { saZone: r.sa_zone as string } : {}),
      })),
      sourceFile: l.rows[0].source_file,
      sourceDate: new Date(`${l.rows[0].source_date}T00:00:00Z`),
      releaseLabel: l.rows[0].release_label,
      loadedAt: l.rows[0].loaded_at,
    };
    this.cached = { at: Date.now(), data };
    return data;
  }
}
