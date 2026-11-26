import { notFound } from "../../core/grounded.js";
import { COVERAGE_STATES, matchRetailer, uniqueDistributors } from "../../tools/energy-common.js";
import { describeLayout, layoutId, layoutWindows } from "../layouts.js";
import type { CachedStore } from "../store.js";
import type { EnergyPlan } from "../types.js";
import type { CompareData } from "./rank.js";

export interface HoursArgs {
  fuelType: "ELECTRICITY" | "GAS";
  currentPlanId?: string;
  hoursLayoutId?: string;
}

export interface SelectArgs {
  fuelType: "ELECTRICITY" | "GAS";
  distributor?: string;
  retailer?: string;
  planType?: "MARKET" | "STANDING" | "REGULATED";
  planIds?: string[];
}

type Failure = { ok: false; result: ReturnType<typeof notFound> };

/** The household's own band hours, to decide which time-of-use estimates a bill split fits exactly. */
export async function resolveHours(store: CachedStore, args: HoursArgs): Promise<{ ok: true; hoursBasis: NonNullable<CompareData["hoursBasis"]> } | Failure> {
  if (args.currentPlanId && args.hoursLayoutId) return { ok: false, result: notFound("needs_input", "Give currentPlanId or hoursLayoutId, not both. Ask the user which they picked in list_current_plan_options.") };
  if (args.currentPlanId) {
    const cur = await store.plan(args.currentPlanId);
    if (!cur) return { ok: false, result: notFound("needs_input", `currentPlanId ${args.currentPlanId} was not found. Call list_current_plan_options again and pass the plan id of the option the user picked.`) };
    const w = layoutWindows(cur, args.fuelType);
    return { ok: true, hoursBasis: w ? { known: true, layoutId: layoutId(w), description: describeLayout(w), from: `${cur.brandName} ${cur.displayName}` } : { known: false } };
  }
  if (args.hoursLayoutId) return { ok: true, hoursBasis: { known: true, layoutId: args.hoursLayoutId } };
  return { ok: true, hoursBasis: { known: false } };
}

export interface Selection {
  plans: EnergyPlan[];
  /** Distributors of the postcode's single-fuel plans. */
  nets: string[];
  distributor?: string;
  matchedRetailer?: string;
  unknownPlanIds?: string[];
}

/** The plans to cost: postcode, customer type, fuel, distributor, retailer, plan type and plan ids. */
export async function selectPlans(store: CachedStore, args: SelectArgs, ctx: { postcode: string; customerType: "RESIDENTIAL" | "BUSINESS" }): Promise<{ ok: true; selection: Selection } | Failure> {
  const { postcode, customerType } = ctx;
  const fail = (result: ReturnType<typeof notFound>): Failure => ({ ok: false, result });
  let plans = (await store.plans({ postcode, customerType })).filter((p) => p.fuelType === args.fuelType || p.fuelType === "DUAL");
  if (plans.length === 0) return fail(notFound("outside_coverage", `No ${args.fuelType.toLowerCase()} plans are stored for postcode ${postcode}. The data covers ${COVERAGE_STATES}.`, { states: COVERAGE_STATES }));

  // Network tariffs differ, so a mixed-network ranking would mislead. Distributors come from single-fuel plans.
  const nets = uniqueDistributors(plans.filter((p) => p.fuelType === args.fuelType).flatMap((p) => p.geography.distributors));
  let distributor = args.distributor;
  if (distributor) {
    const match = nets.find((n) => n.toLowerCase() === distributor!.toLowerCase());
    if (nets.length && !match) return fail(notFound("needs_input", `"${distributor}" is not a distributor for this postcode. Ask the user which one is on their bill.`, { distributors: nets }));
    distributor = match ?? distributor;
    plans = plans.filter((p) => p.geography.distributors.some((x) => x.toLowerCase() === distributor!.toLowerCase()));
  } else if (nets.length > 1) {
    return fail(notFound("needs_input", "This postcode has more than one distributor, and costs differ by network. Ask the user which distributor is on their bill, then call again with distributor.", { distributors: nets }));
  }

  let matchedRetailer: string | undefined;
  if (args.retailer) {
    const m = matchRetailer(plans, args.retailer);
    if (!m) return fail(notFound("not_in_dataset", `No retailer matching "${args.retailer}" has ${args.fuelType.toLowerCase()} plans here.`));
    if ("candidates" in m) return fail(notFound("needs_input", `"${args.retailer}" could match more than one retailer. Ask the user which one they mean.`, { candidates: m.candidates.map((c) => c.brandName) }));
    matchedRetailer = m.brandName;
    plans = plans.filter((p) => p.brandName === m.brandName);
  }
  if (args.planType) plans = plans.filter((p) => p.planType === args.planType);
  let unknownPlanIds: string[] | undefined;
  if (args.planIds?.length) {
    const have = new Set(plans.map((p) => p.planId));
    unknownPlanIds = args.planIds.filter((id) => !have.has(id));
    const want = new Set(args.planIds);
    plans = plans.filter((p) => want.has(p.planId));
  }
  if (plans.length === 0) return fail(notFound("not_in_dataset", "No plans match those filters.", unknownPlanIds ? { unknownPlanIds } : undefined));
  return { ok: true, selection: { plans, nets, ...(distributor ? { distributor } : {}), ...(matchedRetailer ? { matchedRetailer } : {}), ...(unknownPlanIds ? { unknownPlanIds } : {}) } };
}
