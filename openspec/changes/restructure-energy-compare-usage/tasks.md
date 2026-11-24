# Tasks

## 1. Evidence

- [ ] 1.1 On the WSL, run `npm run evals -- --set energy` against the current schema with at least two Claude models. Count compare calls that send a field the handler drops or misreads (the cases in the proposal), and record the count in `docs/energy-evaluation/` as the baseline
- [ ] 1.2 Check the counts in the design still hold on the code at the time (handler length, field list, the 8 test files)

## 2. Refactor with no schema change

- [ ] 2.1 Extract `resolveUsage`, `selectPlans` and `rank` from the handler with today's schema. All existing compare tests pass unchanged
- [ ] 2.2 Add unit tests for `resolveUsage` covering every path in today's handler, including the silent drops (as tests of current behaviour)

## 3. New input

- [ ] 3.1 Replace the usage fields with `usageSource`, `usage` and `usageDays`. Make `customerType` required. Field descriptions start with the sources they belong to
- [ ] 3.2 Put the source table in `resolveUsage`: refuse out-of-source and out-of-fuel fields, warn on `currentPlanId` without a split. Unit tests cover every row of the table
- [ ] 3.3 Add the `assistant_readings` level with its label. Tests cover exact and approximate hours, and the hours-missing case
- [ ] 3.4 Add `usage.level`, `usage.accuracy` and `warnings` to the result, with the accuracy sentence first in the text. Update the 8 compare test files to the new input
- [ ] 3.5 Update field names in `src/energy/instructions.ts`, the energy skill and its worked example, and the readings recipe. `guidance:check` passes
- [ ] 3.6 Update the docs listed in the proposal and the `arg:` checks in the eval prompts. The prompt-set test passes

## 4. Before shipping

- [ ] 4.1 Rerun the eval set from 1.1 on the new schema and record the count next to the baseline
- [ ] 4.2 Check the CDR plan data licence (rule 2.6) and the AER benchmark licence (CC BY 4.0) are still current
