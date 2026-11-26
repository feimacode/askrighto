# Tasks

## 1. Evidence

- [ ] 1.1 (SKIPPED in the implementing session: no model API keys there, so `npm run evals` could not run with real host models. Still to do before shipping) On the WSL, run `npm run evals -- --set energy` against the current schema with at least two Claude models. Count compare calls that send a field the handler drops or misreads (the cases in the proposal), and record the count in `docs/energy-evaluation/` as the baseline
- [x] 1.2 Check the counts in the design still hold on the code at the time (handler length, field list, the 8 test files)
  - Checked on origin/main (2f166b0): 23 input fields and 8 test files hold. The file is 530 lines as stated, but the handler itself is about 255 lines (178 to 433), not 330; the design's "about 330" was the whole function including the schema and helpers.

## 2. Refactor with no schema change

- [x] 2.1 Extract `resolveUsage`, `selectPlans` and `rank` from the handler with today's schema. All existing compare tests pass unchanged
- [x] 2.2 Add unit tests for `resolveUsage` covering every path in today's handler, including the silent drops (as tests of current behaviour)

## 3. New input

NEM12 test helper (a brief from the coordinator, not in the original task list): `test/helpers/nem12.ts`, a seeded generator ported from the one Iven shared, used by `test/energy/readings-upload.test.ts` to check summarise and compare figures against totals computed from the generated intervals. `scripts/make-sample-readings.mjs` is unchanged.

- [x] 3.1 Replace the usage fields with `usageSource`, `usage` and `usageDays`. Make `customerType` required. Field descriptions start with the sources they belong to
- [x] 3.2 Put the source table in `resolveUsage`: refuse out-of-source and out-of-fuel fields, warn on `currentPlanId` without a split. Unit tests cover every row of the table
- [x] 3.3 Add the `assistant_readings` level with its label. Tests cover exact and approximate hours, and the hours-missing case
  - Tests: `test/energy/compare-hours.test.ts` (exact for same hours, approximate for others, layout id, hours missing) and `test/energy/resolve-usage.test.ts`.
- [x] 3.4 Add `usage.level`, `usage.accuracy` and `warnings` to the result, with the accuracy sentence first in the text. Update the 8 compare test files to the new input
- [x] 3.5 Update field names in `src/energy/instructions.ts`, the energy skill and its worked example, and the readings recipe. `guidance:check` passes
- [x] 3.6 Update the docs listed in the proposal and the `arg:` checks in the eval prompts. The prompt-set test passes
  - The energy prompt set had no Checks column, so one was added with `arg:compare_energy_plans.usageSource=...` on the compare prompts (E03 to E07, E09 to E11, E16, E20, E23). `customerType` is not checked: several prompts do not say home or business, so a model may legitimately ask first.

## 4. Before shipping

- [ ] 4.1 Rerun the eval set from 1.1 on the new schema and record the count next to the baseline
- [ ] 4.2 Check the CDR plan data licence (rule 2.6) and the AER benchmark licence (CC BY 4.0) are still current
