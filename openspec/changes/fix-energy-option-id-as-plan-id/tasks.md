## 1. The pick list

- [x] 1.1 In `list-current-plan-options.ts`, remove `optionId` from `PlanOption` and the result; add `currentPlanId` (the first of the option's sorted plan ids, as `planIds[0]`)
- [x] 1.2 Change the text line to "Option N" and name the `currentPlanId`; keep the group key only as an internal map key
- [x] 1.3 Update the tool description, the `currentPlanId` mention in the result's `nextStep`, and the form help to say "pass the picked option's `currentPlanId` unchanged"

## 2. The comparison

- [x] 2.1 Add one shape check on `currentPlanId` (must contain `@`) in `compare-energy-plans.ts` before the usage and hours resolution; return `needs_input` with the message from the design
- [x] 2.2 Extend the `not_in_data` detail in `energy/compare/current.ts` with the "copy from the picked option, or omit" sentence
- [x] 2.3 Update the `currentPlanId` description on `compare_energy_plans` (and `hoursLayoutId`, for consistency)

## 3. Guidance

- [x] 3.1 Check `src/guidance/energy/*.md` for any wording that names an id from the options; make it say `currentPlanId`
- [ ] 3.2 Run `npm run guidance:generate` and commit the regenerated skills in `plugin/skills/`

## 4. Tests

- [x] 4.1 `list_current_plan_options`: the option has `currentPlanId`, no `optionId`; the code-matching plan is first; the text says "Option N"
- [x] 4.2 `compare_energy_plans`: `9affe595`, `1` and a plan name are refused for bill, yearly, readings and typical usage; a retired but well-formed id still returns the ranking with `not_in_data` and the new advice
- [ ] 4.3 Run `npm test` and `npm run lint`; re-run a 10-run scenario on one model with the new build to confirm no option id is passed

## 5. Added in the build (from the 30-run drift test)

- [x] 5.1 `compare_energy_plans` shape check refuses a `currentPlanId` with no `@` that is not a known plan id, so fixtures keep working and a real id is never refused
- [x] 5.2 `compare_energy_plans` warns when a bill split has no `currentPlanId` or `hoursLayoutId`
- [x] 5.3 `customerType` is required in `search_energy_plans` (compare and list_current_plan_options already require it)
- [ ] 5.4 Re-run the 10-run scenario on one model with the new build (not done in the cloud sandbox: no model run here)
