# Tasks

## 1. Verify

- [ ] 1.1 Confirm `restructure-energy-compare-usage` is merged, and that `rank.ts` is the place to add the baseline
- [ ] 1.2 On the data held at the time, count how many current-plan picks from the eval journeys are time-of-use (they get no baseline under typical usage), and record it in the design

## 2. Build

- [ ] 2.1 Cost the current plan in `rank` and return `current`, removing it from the candidate tables. Tests cover a costed baseline, typical usage with a time-of-use plan, a plan id not found, and a plan on another distributor
- [ ] 2.2 Add `differenceFromCurrentCents` and `differenceIfConditionsMetCents`, and the summary count. Tests cover exact and approximate rows and a current plan with and without conditional discounts
- [ ] 2.3 Add the "vs current" column to the text and Inkview table. Add a test that no result uses "save", "better", "switch" or "recommended"
- [ ] 2.4 Add `planName` to `list_current_plan_options`. Tests cover name only, name with figures, and no match falling back to layouts
- [ ] 2.5 Update instructions, the energy skill and docs: say the difference from the current plan, its accuracy label, and the banned words
- [ ] 2.6 Add eval prompts: invoice with current plan picked, name only with no invoice, and typical usage with a time-of-use current plan

## 3. Before shipping

- [ ] 3.1 Run the new eval prompts on the WSL with at least two Claude models and record the results
- [ ] 3.2 Check the CDR plan data licence (rule 2.6) is still current
