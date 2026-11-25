# Proposal

## Why

The main question people bring is "is there a cheaper plan than the one I'm on, from my retailer or another?" Iven (24 Nov 2026) described the intended flow:

1. Identify the current plan. The user may or may not have an invoice or usage.
2. List the eligible plans for the postcode.
3. Cost the current plan and every candidate on the same usage.
4. Rank the candidates.
5. Take discounts into account.

Today `currentPlanId` is used only to find the current plan's band hours, which decides which time-of-use estimates are exact. The current plan itself is never costed. The result has no "what you would pay on your current plan" line, and no plan shows its difference from it. The user has to work that out, or the host does it from memory, which breaks the grounding rule.

Step 1 also has a gap. `list_current_plan_options` needs invoice figures to narrow the list, or `showAllOptions`. A user without an invoice who knows their retailer and plan name has no short path.

## What Changes

- **Current plan baseline.** When `compare_energy_plans` gets `currentPlanId`, it costs that plan on the same usage and with the same rules as every candidate. The result carries it in `current`. If it can't be costed, `current` gives the reason instead, for example a time-of-use plan under typical usage, or a plan no longer in the data.
- **Difference from the current plan.** Each estimate gains `differenceFromCurrentCents`: its cost minus the current plan's cost, both without conditions met. In the "If you meet the conditions" table, both sides are compared with their conditions met. The summary says how many plans have a lower estimate than the current plan.
- **The current plan is not a candidate.** It's shown on its own line above the ranking and is never ranked against itself.
- **Wording.** Always "a lower estimate than your current plan for the usage given", never "better", "save" or "switch". The difference inherits the usage level's accuracy label from `restructure-energy-compare-usage`.
- **Identifying the plan without an invoice.** `list_current_plan_options` accepts a plan name the user states (`planName`, matched as words, not exactly). It returns that retailer's options on the network for the user to pick from, as today. It never picks one automatically.
- **No current plan.** With no `currentPlanId` the comparison works as today: a ranking with no baseline, and the result says no current plan was given.

Discounts:

- Conditional discounts are already in their own table.
- Fixed credits (sign-up and first-year credits) depend on `apply-energy-fixed-discounts`, which still waits on Iven's OK for the "first-year credit" rule.
- Concessions depend on `add-energy-concessions` (not built).

This change uses whatever the estimator applies at the time, on both sides of the difference, so the difference is always like for like.

Data source: unchanged. The tool reads the same AER CDR plan data (rule 2.6) and the existing sync. The current plan's figures carry the same source link and as-of date as every estimate.

Hosts affected: Claude, ChatGPT and Gemini. There's one new optional input on `list_current_plan_options`, and new result fields on `compare_energy_plans`.

Out of scope:

- Checking eligibility conditions against the household (they're still shown, not checked).
- Exit fees in the difference.
- Plans the user is on that are no longer offered. The CDR data holds current offers only, so such a plan has no baseline. Its hours fallback (`hoursLayoutId`) still works.
- Recosting against the invoice amount. This was decided against on 20 Nov 2026: the estimate is annual and the invoice usually monthly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-comparison`: costs the current plan as a baseline and shows each plan's difference from it.
- `energy-current-plan-match`: a stated plan name narrows the pick list when no invoice is at hand.

## Impact

- Changed: `src/energy/compare/rank.ts` (from the restructure change), `src/tools/list-current-plan-options.ts`, the compare and current-plan tests, the Inkview table columns, `docs/energy-estimates.md`, `docs/energy-invoice.md`, and the eval prompts (new rows for the baseline).
- Depends on `restructure-energy-compare-usage`.
- No migration.
