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
if (overdue.length) process.exit(1);

// Home loans: public listing is blocked until the credit legal view is recorded and every dataset is cleared.
const publicIds = (process.env.ASKRIGHTO_PUBLIC_VERTICALS ?? "").split(",").map((x) => x.trim());
if (publicIds.includes("home-loans")) {
  const notCleared = rights.filter((e) => ["home-loans-cdr", "rba-cash-rate"].includes(e.datasetId) && e.status !== "cleared");
  for (const e of notCleared) console.error(`home-loans is public but ${e.datasetId} is ${e.status}`);
  if (notCleared.length) process.exit(1);
}
