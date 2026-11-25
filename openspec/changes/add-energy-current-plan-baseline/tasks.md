# Tasks

## 1. Verify

- [x] 1.1 Confirm `restructure-energy-compare-usage` is merged, and that `rank.ts` is the place to add the baseline
  - Not merged yet: this branch is stacked on PR #89 (restructure-energy-compare-usage). `rank.ts` is the place, plus a new `src/energy/compare/current.ts` for costing the plan.
- [ ] 1.2 On the data held at the time, count how many current-plan picks from the eval journeys are time-of-use (they get no baseline under typical usage), and record it in the design
  - Not done: needs the real plan data and eval journeys (the WSL), not the synthetic fixtures here.

## 2. Build

- [x] 2.1 Cost the current plan in `rank` and return `current`, removing it from the candidate tables. Tests cover a costed baseline, typical usage with a time-of-use plan, a plan id not found, and a plan on another distributor
- [x] 2.2 Add `differenceFromCurrentCents` and `differenceIfConditionsMetCents`, and the summary count. Tests cover exact and approximate rows and a current plan with and without conditional discounts
- [x] 2.3 Add the "vs current" column to the text and Inkview table. Add a test that no result uses "save", "better", "switch" or "recommended"
- [x] 2.4 Add `planName` to `list_current_plan_options`. Tests cover name only, name with figures, and no match falling back to layouts
- [x] 2.5 Update instructions, the energy skill and docs: say the difference from the current plan, its accuracy label, and the banned words
- [x] 2.6 Add eval prompts: invoice with current plan picked, name only with no invoice, and typical usage with a time-of-use current plan

Note: `usageSource: typical` now accepts `currentPlanId`, which the restructure change refused, because the design costs a time-of-use current plan under typical usage and reports why it has no baseline.

## 3. Before shipping

- [ ] 3.1 Run the new eval prompts on the WSL with at least two Claude models and record the results
- [ ] 3.2 Check the CDR plan data licence (rule 2.6) is still current
