## Context

`currentPlanId` reaches the store today only to read the plan's band-hour layout (`layoutWindows`, `layoutId`). The estimator `estimateAnnualCost(plan, usage)` already costs any stored plan, including the current one, so the baseline is one more call on the same usage. The plan is looked up by id regardless of the filters, so a filter like `retailer` or `planIds` that would exclude it doesn't stop it being costed.

## Decisions

1. **Same rules both sides.** The current plan is costed by the same estimator, on the same resolved usage. With a bill split, it is exact by definition, because the split describes use against its own hours. Discounts, GST and feed-in follow whatever the estimator applies at the time.

2. **The difference uses no-conditions cost by default.** `differenceFromCurrentCents = estimate.totalCents - current.totalCents`. In the conditions table, `differenceIfConditionsMetCents` compares a plan's cost with its conditions met against the current plan's cost with its own conditions met. If the current plan has no conditional discount, that's its plain cost. This answers the open question in the thread: show both, each like for like, with the safer no-conditions figure in the main table.

3. **When there's no baseline.** `current` is `{ costed: false, reason }` for:
   - a plan id not in the data;
   - a time-of-use current plan under `typical` usage;
   - a plan the estimator can't cost (the same reasons as `notEstimated`);
   - a current plan for another fuel or distributor than the comparison.

   The ranking still runs, and no difference is shown. The summary says why there's no baseline.

4. **Approximate rows.** For an approximate (different-hours) estimate, the difference is also labelled approximate. A difference is never shown without its row's label.

5. **Not a candidate.** The current plan is removed from `estimates`, `approximateHours` and `ifConditionsMet` if it appears, and shown once in `current`. The counts include it separately (`counts.current: 0 | 1`).

6. **Plan name for the pick list.** `list_current_plan_options` gains optional `planName` (max 80 characters). It's used only as a ranking hint alongside invoice figures, and alone it narrows options to those whose display name shares words with it. The result is still a list for the user to pick from. A name never selects a plan by itself, which keeps the 20 Nov decision not to match by name.

7. **Wording in results.** The summary uses "lower estimate than your current plan for the usage given". The Inkview table gains a "vs current" column with a signed dollar figure. The words "save", "better", "switch" and "recommended" never appear in result text, and a test checks this.

8. **Source and date.** `current` carries the same `planUrl`/link, source link, licence and as-of date as any estimate.

## Risks / Trade-offs

- A small difference under typical usage can mislead. The accuracy sentence leads the result, and the summary says real cost can differ a lot, as today.
- A user may be on a plan whose published rates have changed since their invoice. The baseline uses today's published rates, and the result says so in one assumption line.

## Open Questions

- Should a plan only slightly cheaper (for example under $20 a year) be counted in "N plans have a lower estimate"? The proposal counts every plan. A threshold could be added later if hosts overstate small differences.
