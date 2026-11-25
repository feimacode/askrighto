import { estimateAnnualCost, type Estimate, type Usage } from "../calc.js";
import { planLink } from "../links.js";
import type { CachedStore } from "../store.js";
import type { CurrentPlan } from "./rank.js";

export const CURRENT_PLAN_NOTE = "Costed at today's published rates, which may differ from the rates on the household's invoice.";

/**
 * Costs the household's current plan on the same usage as the candidates (add-energy-current-plan-baseline).
 * The plan is looked up by id whatever the other filters are. When it cannot be costed, `current` says why and the
 * ranking still runs without differences.
 */
export async function resolveCurrent(
  store: CachedStore,
  args: { currentPlanId?: string; hoursLayoutId?: string; fuelType: "ELECTRICITY" | "GAS" },
  ctx: { postcode: string; customerType: "RESIDENTIAL" | "BUSINESS"; distributor?: string; usage: Usage },
): Promise<{ current: CurrentPlan; estimate?: Estimate }> {
  if (!args.currentPlanId) {
    return { current: { costed: false, reason: "no_current_plan", detail: `No current plan was given, so no difference from it is shown.${args.hoursLayoutId ? " Only the band hours were given, which cannot be costed as a plan." : ""}` } };
  }
  const id = args.currentPlanId;
  const plan = await store.plan(id);
  if (!plan) return { current: { costed: false, planId: id, reason: "not_in_data", detail: `The current plan ${id} is not in the current published data, so it was not costed and no difference from it is shown.` } };
  const wrong =
    (plan.fuelType !== args.fuelType && plan.fuelType !== "DUAL") ||
    plan.customerType !== ctx.customerType ||
    (ctx.distributor !== undefined && !plan.geography.distributors.some((x) => x.toLowerCase() === ctx.distributor!.toLowerCase()));
  if (wrong) {
    return { current: { costed: false, planId: id, reason: "other_fuel_or_network", detail: `The current plan ${id} is for another fuel, customer type or distributor than this comparison, so it was not costed and no difference from it is shown.` } };
  }
  const r = estimateAnnualCost(plan, ctx.usage);
  if (!r.estimated) {
    return { current: { costed: false, planId: id, reason: "not_estimated", detail: `The current plan ${plan.brandName} ${plan.displayName} could not be costed (${r.reason}): ${r.detail} No difference from it is shown.` } };
  }
  return {
    estimate: r,
    current: {
      costed: true,
      planId: r.planId,
      brandName: r.brandName,
      displayName: r.displayName,
      ...(r.planUrl ? { planUrl: r.planUrl } : {}),
      link: planLink(r, ctx.postcode),
      sourceLastUpdated: r.sourceLastUpdated,
      totalCents: r.totalCents,
      totalIfConditionsMetCents: r.totalIfConditionsMetCents,
      breakdown: r.breakdown,
      conditionalDiscounts: r.conditionalDiscounts,
      notes: r.notes,
      notIncluded: r.notIncluded,
      restrictions: r.restrictions,
      note: CURRENT_PLAN_NOTE,
    },
  };
}
