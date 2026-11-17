/** Loading and reading the health cover store. A load replaces every row in one transaction. */
import type { Db } from "../energy/db.js";
import type { HealthParseReport } from "./parse.js";
import type {
  CoverKind,
  HealthData,
  HealthInsurer,
  HealthPremium,
  HealthProduct,
  HealthSource,
  ProductHousehold,
} from "./types.js";

export class NoHealthLoad extends Error {
  constructor() {
    super("no health cover load yet");
  }
}

export interface HealthLoadInput {
  insurers: HealthInsurer[];
  products: HealthProduct[];
  categoryTitles: string[];
  sourceFile: string;
  sourceDate: string; // YYYY-MM-DD
  fileHash: string;
  report: HealthParseReport;
  gitSha?: string;
}

const BATCH = 500;
const COLS = [
  "id", "insurer_id", "code", "name", "kind", "status", "tier", "state", "household", "dependants_covered",
  "excess_type", "excess_per_admission_cents", "excess_per_person_cents", "excess_per_policy_cents", "excess_cents",
  "copayment_type", "mls_exempt", "corporate", "only_available_with", "info_url", "premium_cents",
  "hospital_component_cents", "cover_codes", "waiting",
] as const;

const rowOf = (p: HealthProduct): unknown[] => [
  p.id, p.insurerId, p.code, p.name, p.kind, p.status, p.tier ?? null, p.state ?? null, p.household ?? null,
  p.dependantsCovered ?? null, p.excessType ?? null, p.excessPerAdmissionCents ?? null, p.excessPerPersonCents ?? null,
  p.excessPerPolicyCents ?? null, p.excessCents ?? null, p.coPaymentType ?? null, p.mlsExempt ?? null,
  p.corporate ?? false, p.onlyAvailableWith ?? null, p.infoUrl ?? null, p.premiums[0]?.amountCents ?? null,
  p.hospitalComponentCents ?? null, p.coverCodes, JSON.stringify(p.waiting),
];

export async function loadHealth(db: Db, input: HealthLoadInput): Promise<{ rows: number }> {
  if (input.products.length === 0) throw new Error("refusing to load an empty product list");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate)) throw new Error("source date must be YYYY-MM-DD");
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL search_path TO ${db.schema}`);
    await c.query("DELETE FROM health_products");
    await c.query("DELETE FROM health_insurers");
    for (const i of input.insurers)
      await c.query("INSERT INTO health_insurers (id, name, fund_type, restriction_hint) VALUES ($1,$2,$3,$4)", [
        i.id,
        i.name,
        i.fundType ?? null,
        i.restrictionHint ?? null,
      ]);
    for (let at = 0; at < input.products.length; at += BATCH) {
      const rows = input.products.slice(at, at + BATCH).map(rowOf);
      const values = rows.map((_, r) => `(${COLS.map((_k, k) => `$${r * COLS.length + k + 1}`).join(",")})`).join(",");
      await c.query(`INSERT INTO health_products (${COLS.join(",")}) VALUES ${values}`, rows.flat());
    }
    await c.query(
      "INSERT INTO health_loads (source_file, source_date, file_hash, git_sha, row_count, category_titles, report) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        input.sourceFile,
        input.sourceDate,
        input.fileHash,
        input.gitSha ?? null,
        input.products.length,
        JSON.stringify(input.categoryTitles),
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
    const [ins, prods, load] = await Promise.all([
      q.query("SELECT * FROM health_insurers ORDER BY name"),
      q.query("SELECT * FROM health_products ORDER BY insurer_id, name, id"),
      q.query(
        "SELECT loaded_at, source_file, category_titles, to_char(source_date,'YYYY-MM-DD') AS source_date FROM health_loads ORDER BY id DESC LIMIT 1",
      ),
    ]);
    if (!load.rows[0]) throw new NoHealthLoad();
    const n = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
    const opt = <K extends string>(key: K, v: number | undefined) => (v !== undefined ? { [key]: v } : {});
    const data: HealthData = {
      insurers: ins.rows.map((r) => ({
        id: r.id,
        name: r.name,
        ...(r.fund_type ? { fundType: r.fund_type as "open" | "restricted" } : {}),
        ...(r.restriction_hint ? { restrictionHint: r.restriction_hint } : {}),
      })),
      categoryTitles: (load.rows[0].category_titles ?? []) as string[],
      products: prods.rows.map(
        (r): HealthProduct => ({
          id: r.id,
          insurerId: r.insurer_id,
          code: r.code,
          name: r.name,
          kind: r.kind as CoverKind,
          status: r.status === "closed" ? "closed" : "open",
          ...(r.tier ? { tier: r.tier } : {}),
          ...(r.state ? { state: r.state } : {}),
          ...(r.household ? { household: r.household as ProductHousehold } : {}),
          ...(r.dependants_covered ? { dependantsCovered: r.dependants_covered as string[] } : {}),
          ...(r.excess_type ? { excessType: r.excess_type } : {}),
          ...opt("excessPerAdmissionCents", n(r.excess_per_admission_cents)),
          ...opt("excessPerPersonCents", n(r.excess_per_person_cents)),
          ...opt("excessPerPolicyCents", n(r.excess_per_policy_cents)),
          ...opt("excessCents", n(r.excess_cents)),
          ...(r.copayment_type ? { coPaymentType: r.copayment_type } : {}),
          ...(r.mls_exempt !== null ? { mlsExempt: r.mls_exempt as boolean } : {}),
          corporate: r.corporate === true,
          ...(r.only_available_with ? { onlyAvailableWith: r.only_available_with } : {}),
          premiums:
            n(r.premium_cents) !== undefined
              ? ([{ amountCents: n(r.premium_cents)!, frequency: "monthly", basis: "before_rebate" }] as HealthPremium[])
              : [],
          ...opt("hospitalComponentCents", n(r.hospital_component_cents)),
          coverCodes: r.cover_codes ?? "",
          waiting: (r.waiting ?? []) as HealthProduct["waiting"],
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
