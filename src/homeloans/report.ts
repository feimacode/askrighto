/** Coverage and freshness report over the stored home loan data. Reads a snapshot, writes nothing. */
import { rightsFor, type RightsStatus } from "../core/rights.js";
import { ANSWERING_WINDOW_MS } from "./index.js";
import type { HomeLoanData } from "./types.js";

export interface HomeLoanReport {
  lenders: { listed: number; answering: number; failing: string[] };
  products: number;
  share: {
    understood: number;
    tailored: number;
    withComparisonRate: number;
    withLvrTiers: number;
    fixedTermReadable: number;
    withFees: number;
    withOffset: number;
  };
  oldestVerifiedDays: number | null;
  notUnderstoodReasons: Record<string, number>;
  rights: Record<string, RightsStatus | "missing">;
  cashRate: { valuePct: number; effectiveDate: string } | null;
  problems: string[];
}

const share = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function buildReport(d: HomeLoanData, now: Date = new Date()): HomeLoanReport {
  const ps = d.products;
  const rates = ps.flatMap((p) => p.rates);
  const fixed = rates.filter((r) => r.type === "FIXED" || r.type === "BUNDLE_DISCOUNT_FIXED");
  const active = d.lenders.filter((l) => l.active);
  const answering = active.filter((l) => l.lastSyncOk && l.lastSyncAt && now.getTime() - l.lastSyncAt.getTime() < ANSWERING_WINDOW_MS);
  const reasons: Record<string, number> = {};
  for (const p of ps) for (const r of p.notUnderstood) reasons[r] = (reasons[r] ?? 0) + 1;
  const rights = Object.fromEntries(["home-loans-cdr", "rba-cash-rate"].map((id) => [id, rightsFor(id)?.status ?? "missing"])) as HomeLoanReport["rights"];
  const problems: string[] = [];
  for (const [id, st] of Object.entries(rights))
    if (st === "pending" || st === "refused" || st === "withdrawn" || st === "missing") problems.push(`dataset ${id} has rights status ${st}`);
  if (ps.length === 0) problems.push("no products loaded");
  return {
    lenders: { listed: active.length, answering: answering.length, failing: active.filter((l) => l.lastSyncOk === false).map((l) => l.slug) },
    products: ps.length,
    share: {
      understood: share(ps.filter((p) => p.understood).length, ps.length),
      tailored: share(ps.filter((p) => p.isTailored).length, ps.length),
      withComparisonRate: share(rates.filter((r) => r.comparisonRate !== undefined).length, rates.length),
      withLvrTiers: share(rates.filter((r) => r.tiers.some((t) => t.unit === "PERCENT_LVR")).length, rates.length),
      fixedTermReadable: share(fixed.filter((r) => r.fixedTermMonths !== undefined).length, fixed.length),
      withFees: share(ps.filter((p) => p.fees.length > 0).length, ps.length),
      withOffset: share(ps.filter((p) => p.features.some((f) => f.type === "OFFSET")).length, ps.length),
    },
    oldestVerifiedDays: d.lastVerified ? Math.floor((now.getTime() - d.lastVerified.getTime()) / 86_400_000) : null,
    notUnderstoodReasons: reasons,
    rights,
    cashRate: d.cashRate ? { valuePct: d.cashRate.valuePct, effectiveDate: d.cashRate.effectiveDate } : null,
    problems,
  };
}

export function formatReport(r: HomeLoanReport): string {
  return [
    `Lenders: ${r.lenders.listed} listed, ${r.lenders.answering} answering in 48h, failing: ${r.lenders.failing.join(", ") || "none"}`,
    `Products: ${r.products}`,
    ...Object.entries(r.share).map(([k, v]) => `  ${k}: ${v}%`),
    `Oldest verified: ${r.oldestVerifiedDays ?? "n/a"} day(s) ago`,
    `Not understood reasons: ${JSON.stringify(r.notUnderstoodReasons)}`,
    `Rights: ${JSON.stringify(r.rights)}`,
    `Cash rate: ${r.cashRate ? `${r.cashRate.valuePct}% from ${r.cashRate.effectiveDate}` : "not loaded"}`,
    r.problems.length ? `PROBLEMS:\n  ${r.problems.join("\n  ")}` : "No problems found.",
  ].join("\n");
}
