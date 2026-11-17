/** Loading and reading the health cover store. A load replaces every row in one transaction. */
import { createHash } from "node:crypto";
import type { Db } from "../energy/db.js";
import type { HealthParseReport } from "./parse.js";
import type {
  CoverKind,
  CoverState,
  HealthData,
  HealthInsurer,
  HealthPremium,
  HealthProduct,
  HealthSource,
  Household,
} from "./types.js";

export class NoHealthLoad extends Error {
  constructor() {
    super("no health cover load yet");
  }
}

export interface HealthLoadInput {
  insurers: HealthInsurer[];
  products: HealthProduct[];
  sourceFile: string;
  sourceDate: string; // YYYY-MM-DD
  fileHash: string;
  report: HealthParseReport;
  gitSha?: string;
}

export const hashFiles = (files: { name: string; xml: string }[]) =>
  createHash("sha256")
    .update(JSON.stringify([...files].sort((a, b) => a.name.localeCompare(b.name))))
    .digest("hex");

export async function loadHealth(db: Db, input: HealthLoadInput): Promise<{ rows: number }> {
  if (input.products.length === 0) throw new Error("refusing to load an empty product list");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate)) throw new Error("source date must be YYYY-MM-DD");
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL search_path TO ${db.schema}`);
    await c.query("DELETE FROM health_waiting_periods");
    await c.query("DELETE FROM health_product_categories");
    await c.query("DELETE FROM health_products");
    await c.query("DELETE FROM health_insurers");
    for (const i of input.insurers)
      await c.query("INSERT INTO health_insurers (id, name) VALUES ($1,$2)", [i.id, i.name]);
    for (const p of input.products) {
      await c.query(
        `INSERT INTO health_products (id, insurer_id, code, name, kind, tier, state, household, excess_cents, excess_type, info_url, premiums)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          p.id,
          p.insurerId,
          p.code,
          p.name,
          p.kind,
          p.tier ?? null,
          p.state ?? null,
          p.household ?? null,
          p.excessCents ?? null,
          p.excessType ?? null,
          p.infoUrl ?? null,
          JSON.stringify(p.premiums),
        ],
      );
      for (const k of p.categories)
        await c.query(
          "INSERT INTO health_product_categories (product_id, code, label, cover) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [p.id, k.code, k.label, k.cover],
        );
      for (const w of p.waiting)
        await c.query(
          "INSERT INTO health_waiting_periods (product_id, type, months) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [p.id, w.type, w.months],
        );
    }
    await c.query(
      "INSERT INTO health_loads (source_file, source_date, file_hash, git_sha, row_count, report) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        input.sourceFile,
        input.sourceDate,
        input.fileHash,
        input.gitSha ?? null,
        input.products.length,
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
  return { rows: input.products.length };
}

export class HealthStore implements HealthSource {
  private cached: { at: number; data: HealthData } | undefined;
  constructor(
    private db: Db,
    private ttlMs = 5 * 60_000,
  ) {}
  clear(): void {
    this.cached = undefined;
  }
  async data(): Promise<HealthData> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs) return this.cached.data;
    const q = this.db.pool;
    const [ins, prods, cats, waits, load] = await Promise.all([
      q.query("SELECT * FROM health_insurers ORDER BY name"),
      q.query("SELECT * FROM health_products ORDER BY insurer_id, name, id"),
      q.query("SELECT * FROM health_product_categories ORDER BY product_id, code"),
      q.query("SELECT * FROM health_waiting_periods ORDER BY product_id, type"),
      q.query(
        "SELECT loaded_at, source_file, to_char(source_date,'YYYY-MM-DD') AS source_date FROM health_loads ORDER BY id DESC LIMIT 1",
      ),
    ]);
    if (!load.rows[0]) throw new NoHealthLoad();
    const catsBy = new Map<string, HealthProduct["categories"]>();
    for (const r of cats.rows)
      catsBy.set(r.product_id, [
        ...(catsBy.get(r.product_id) ?? []),
        { code: r.code, label: r.label, cover: r.cover as CoverState },
      ]);
    const waitBy = new Map<string, HealthProduct["waiting"]>();
    for (const r of waits.rows)
      waitBy.set(r.product_id, [...(waitBy.get(r.product_id) ?? []), { type: r.type, months: Number(r.months) }]);
    const data: HealthData = {
      insurers: ins.rows.map((r) => ({ id: r.id, name: r.name })),
      products: prods.rows.map(
        (r): HealthProduct => ({
          id: r.id,
          insurerId: r.insurer_id,
          code: r.code,
          name: r.name,
          kind: r.kind as CoverKind,
          ...(r.tier ? { tier: r.tier } : {}),
          ...(r.state ? { state: r.state } : {}),
          ...(r.household ? { household: r.household as Household } : {}),
          ...(r.excess_cents !== null ? { excessCents: Number(r.excess_cents) } : {}),
          ...(r.excess_type ? { excessType: r.excess_type } : {}),
          premiums: (r.premiums ?? []) as HealthPremium[],
          categories: catsBy.get(r.id) ?? [],
          waiting: waitBy.get(r.id) ?? [],
          ...(r.info_url ? { infoUrl: r.info_url } : {}),
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
