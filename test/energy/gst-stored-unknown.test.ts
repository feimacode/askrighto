/**
 * A plan stored while the GST basis was unconfirmed (gstBasis "UNKNOWN") is read with the confirmed basis, so its prices are
 * shown and costed before renormalise-energy has been run (seen 23 Nov 2026: "Price withheld" for an AGL plan).
 */
import { describe, expect, it } from "vitest";
import { estimateAnnualCost } from "../../src/energy/calc.js";
import { rowToPlan } from "../../src/energy/store.js";
import { fixture } from "./mock-cdr.js";
import { normalisePlan } from "../../src/energy/normalise.js";

function row(basis: string) {
  const f = fixture("single-rate");
  const n = normalisePlan("agl", { planId: f.planId, displayName: f.displayName, fuelType: "ELECTRICITY", type: "MARKET", customerType: "RESIDENTIAL", lastUpdated: f.lastUpdated, brand: "agl", brandName: "AGL" } as never, f, "EXCLUSIVE");
  const p = n.plan;
  return {
    plan_id: p.planId, retailer_slug: p.retailerSlug, brand_name: p.brandName, display_name: p.displayName, fuel_type: p.fuelType, plan_type: p.planType, customer_type: "RESIDENTIAL",
    effective_from: null, effective_to: null, plan_url: null, source_last_updated: new Date("2026-09-28"), fetched_at: new Date(), verified_at: new Date(),
    understood: true, not_understood: [], included_postcodes: [3000], excluded_postcodes: [], distributors: ["CitiPower"],
    contract: { electricity: { ...p.electricity!, gstBasis: basis }, gas: null },
  };
}

describe("stored GST basis", () => {
  it("reads a contract stored as UNKNOWN with the confirmed basis, and can cost it", () => {
    const plan = rowToPlan(row("UNKNOWN"));
    expect(plan.electricity!.gstBasis).toBe("EXCLUSIVE");
    const e = estimateAnnualCost(plan, { fuel: "ELECTRICITY", annualUsage: 4000 });
    expect(e.estimated).toBe(true);
  });
  it("keeps a basis that was stored as confirmed", () => {
    expect(rowToPlan(row("EXCLUSIVE")).electricity!.gstBasis).toBe("EXCLUSIVE");
    expect(rowToPlan(row("INCLUSIVE")).electricity!.gstBasis).toBe("INCLUSIVE");
  });
});
