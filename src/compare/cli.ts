/** compare:usecases. Read-only: it never writes to the database. */
import { createDb, dbConfig } from "../energy/db.js";
import { coverageReport, formatReport } from "./coverage.js";

export async function cliCompareUseCases(args: string[]): Promise<void> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("DATABASE_URL is not set");
  const db = createDb(cfg);
  try {
    const r = await coverageReport(db);
    console.log(
      args.includes("--json") ? JSON.stringify(r, null, 2) : formatReport(r),
    );
  } finally {
    await db.close();
  }
}
