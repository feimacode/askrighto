/**
 * PostgreSQL access: a small pool and a migration runner that touches only the Ask Righto
 * schema. Mirrors the shared-instance conventions of feimacode/feima-api: DATABASE_URL plus a
 * separate DATABASE_SCHEMA, a deliberately small pool and a 15 second connect timeout.
 */
import pg from "pg";
import { sql as m0001 } from "./migrations/0001-init.js";
import { sql as m0002 } from "./migrations/0002-courses.js";
import { sql as m0003 } from "./migrations/0003-vce.js";
import { sql as m0004 } from "./migrations/0004-intl.js";
import { sql as m0005 } from "./migrations/0005-health.js";
import { sql as m0006 } from "./migrations/0006-home-loans.js";
import { sql as m0007 } from "./migrations/0007-careers.js";
import { sql as m0008 } from "./migrations/0008-energy-benchmarks.js";
import { sql as m0009 } from "./migrations/0009-intl-vet.js";
import { sql as m0010 } from "./migrations/0010-course-regions.js";

export interface DbConfig {
  url: string;
  schema: string;
  poolMax: number;
  ssl: boolean;
}

export function dbConfig(
  env: NodeJS.ProcessEnv = process.env,
): DbConfig | undefined {
  const url = env.DATABASE_URL;
  if (!url) return undefined;
  const poolMax = parseInt(env.ASKRIGHTO_DB_POOL_MAX ?? "5", 10);
  return {
    url,
    schema: env.DATABASE_SCHEMA ?? "askrighto",
    poolMax: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
    ssl: /^(1|true|require)$/i.test(env.ASKRIGHTO_DB_SSL ?? ""),
  };
}

/** Only schemas named askrighto or askrighto_* are ever touched. */
const SCHEMA_RE = /^askrighto(_[a-z0-9_]+)?$/;

export function assertSchema(schema: string): string {
  if (!SCHEMA_RE.test(schema))
    throw new Error(
      `Refusing to use schema "${schema}": Ask Righto only manages schemas named askrighto or askrighto_*`,
    );
  return schema;
}

export interface Db {
  pool: pg.Pool;
  schema: string;
  close(): Promise<void>;
}

export function createDb(
  cfg: Pick<DbConfig, "url" | "schema" | "poolMax"> & {
    ssl?: boolean;
    statementTimeoutMs?: number;
  },
): Db {
  const schema = assertSchema(cfg.schema);
  const pool = new pg.Pool({
    connectionString: cfg.url,
    max: cfg.poolMax,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    ...(cfg.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    options: `-c search_path=${schema}${cfg.statementTimeoutMs ? ` -c statement_timeout=${Math.floor(cfg.statementTimeoutMs)}` : ""}`,
  });
  // A dropped idle connection must not crash the process.
  pool.on("error", (e) => console.error(`database pool error: ${e.message}`));
  return { pool, schema, close: () => pool.end() };
}

export const MIGRATIONS: ReadonlyArray<{
  version: number;
  name: string;
  sql: string;
}> = [
  { version: 1, name: "init", sql: m0001 },
  { version: 2, name: "courses", sql: m0002 },
  { version: 3, name: "vce", sql: m0003 },
  { version: 4, name: "intl", sql: m0004 },
  { version: 5, name: "health", sql: m0005 },
  { version: 6, name: "home-loans", sql: m0006 },
  { version: 7, name: "careers", sql: m0007 },
  { version: 8, name: "energy-benchmarks", sql: m0008 },
  { version: 9, name: "intl-vet", sql: m0009 },
  { version: 10, name: "course-regions", sql: m0010 },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** Creates the schema if absent and applies pending migrations, each in its own transaction. */
export async function migrate(db: Db): Promise<number[]> {
  const applied: number[] = [];
  const c = await db.pool.connect();
  try {
    await c.query(`CREATE SCHEMA IF NOT EXISTS ${db.schema}`);
    await c.query(`SET search_path TO ${db.schema}`);
    await c.query("SELECT pg_advisory_lock(hashtext($1))", [
      `${db.schema}:migrate`,
    ]);
    try {
      await c.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const done = new Set(
        (
          await c.query<{ version: number }>(
            "SELECT version FROM schema_migrations",
          )
        ).rows.map((r) => r.version),
      );
      for (const m of MIGRATIONS) {
        if (done.has(m.version)) continue;
        await c.query("BEGIN");
        try {
          await c.query(m.sql);
          await c.query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
            [m.version, m.name],
          );
          await c.query("COMMIT");
          applied.push(m.version);
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        }
      }
    } finally {
      await c.query("SELECT pg_advisory_unlock(hashtext($1))", [
        `${db.schema}:migrate`,
      ]);
    }
  } finally {
    c.release();
  }
  return applied;
}

/** True when the schema has reached `required` (default: the latest). Each data module names the version it needs. */
export async function schemaCurrent(
  db: Db,
  required: number = LATEST_VERSION,
): Promise<boolean> {
  try {
    const r = await db.pool.query<{ v: number | null }>(
      "SELECT max(version) AS v FROM schema_migrations",
    );
    return (r.rows[0]?.v ?? 0) >= required;
  } catch (e) {
    // Missing table (42P01) or schema (3F000) means migrations have not run; anything else is an outage.
    const code = (e as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return false;
    throw e;
  }
}
