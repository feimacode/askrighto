// Fails when a served dataset is past its review-by date. Run before a release: npm run release:check
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const rights = JSON.parse(readFileSync(resolve(import.meta.dirname, "../src/core/rights.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const served = ["cleared", "cleared_pending_legal_view"];
const overdue = rights.filter((e) => served.includes(e.status) && e.reviewBy < today);
for (const e of overdue) console.error(`overdue: ${e.datasetId} was due for review by ${e.reviewBy}`);
const legal = rights.filter((e) => e.status === "cleared_pending_legal_view").map((e) => e.datasetId);
if (legal.length) console.log(`note: awaiting the legal view (blocks public listing): ${legal.join(", ")}`);
process.exit(overdue.length ? 1 : 0);
