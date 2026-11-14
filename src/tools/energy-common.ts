/** Shared pieces of the energy tools: notice, wording, input checks, retailer matching, GST display, Inkview wrapper. */
import { inkview, inkviewToolMeta, type ComponentId } from "@feimacode/inkview-sdk";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { notFound, type Found, type Grounded } from "../core/grounded.js";
import { ENERGY_SOURCE, getEnergy } from "../energy/index.js";
import { formatMoney } from "../energy/money.js";
import type { Contract, EnergyPlan } from "../energy/types.js";

/** Appears in the structured and the text form of every found energy result. */
export const NOTICE =
  "These figures come from retailers' published plan data (AER, Consumer Data Right) and are general information only, not a recommendation or advice. Confirm the details with the retailer before switching.";

export const COVERAGE_STATES = "NSW, QLD, SA, TAS, VIC and the ACT";

export const dollars = (cents: number): string => {
  const abs = Math.abs(cents) / 100;
  return `${cents < 0 ? "-" : ""}$${abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function checkPostcode(v: string): string | undefined {
  return /^\d{4}$/.test(v.trim()) ? v.trim() : undefined;
}

export const badPostcode = () => notFound("needs_input", "A postcode is four digits, for example 3000. Ask the user for the postcode of the property.");

/** Lower-case letters and digits only, so "Origin Energy" and "origin-energy" match. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

export type RetailerMatch = { slug: string; brandName: string } | { candidates: Array<{ slug: string; brandName: string }> } | undefined;

/** Exact match first, then prefix/contains, then edit distance of at most two. Several equal matches return candidates. */
export function matchRetailer(plans: EnergyPlan[], input: string): RetailerMatch {
  const q = norm(input);
  if (!q) return undefined;
  const brands = new Map<string, { slug: string; brandName: string }>();
  for (const p of plans) brands.set(p.retailerSlug, { slug: p.retailerSlug, brandName: p.brandName });
  const list = [...brands.values()];
  const keys = (b: { slug: string; brandName: string }) => [norm(b.brandName), norm(b.slug)];
  const tiers: Array<(b: { slug: string; brandName: string }) => boolean> = [
    (b) => keys(b).includes(q),
    (b) => keys(b).some((k) => k.startsWith(q) || (q.length >= 4 && q.startsWith(k) && k.length >= 3)),
    (b) => keys(b).some((k) => distance(k, q) <= 2),
  ];
  for (const t of tiers) {
    const hit = list.filter(t);
    if (hit.length === 1) return hit[0]!;
    if (hit.length > 1) return { candidates: hit };
  }
  return undefined;
}

/** Scaled money to displayed dollars including GST, or undefined while the GST basis is unconfirmed. */
export function incGst(c: Contract | undefined, units: number | undefined): number | undefined {
  if (units === undefined || !c || c.gstBasis === "UNKNOWN") return undefined;
  const v = c.gstBasis === "EXCLUSIVE" ? units * 1.1 : units;
  return v;
}

export const fmtRate = (c: Contract | undefined, units: number | undefined, unit: string): string | undefined => {
  const v = incGst(c, units);
  if (v === undefined) return undefined;
  const per = unit === "KWH" ? "kWh" : unit.toLowerCase();
  return `${formatMoney(v, 4)}/${per}`;
};

export function asOfFor(plans: EnergyPlan[]): Date {
  const synced = getEnergy()?.snapshot()?.lastSuccessfulSync;
  if (synced) return synced;
  const times = plans.map((p) => Date.parse(p.verifiedAt)).filter(Number.isFinite);
  return new Date(times.length ? Math.min(...times) : Date.now());
}

export const source = ENERGY_SOURCE;

/**
 * Builds the Inkview component for a found result and carries our grounded envelope beside it,
 * so hosts that draw components get the view and every host still gets source, date and notice.
 * Text content stays our own markdown, which always ends with the notice and source line.
 */
export function inkviewResult(
  result: Grounded<unknown>,
  build: () => CallToolResult,
): Partial<CallToolResult> | undefined {
  if (!result.found) return undefined;
  try {
    const ink = build();
    return { structuredContent: { ...(ink.structuredContent ?? {}), grounded: result as unknown as Record<string, unknown> } };
  } catch (e) {
    // A component that fails validation must not lose the answer: fall back to the plain result.
    console.error(`Inkview component skipped: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`);
    return undefined;
  }
}

export const tableMeta = (component: ComponentId) => inkviewToolMeta({ component });

export const inkviewSource = (r: Found<unknown>) => ({ name: r.source.name, url: r.source.url, retrievedAt: r.asOf });

export { inkview };
