# Tasks

## 1. Build

- [x] 1.1 Pull the per-plan rate formatting out of `get-energy-plan.ts` into a shared helper. The `get_energy_plan` tests pass unchanged
  - Now `src/energy/plan-view.ts`.
- [x] 1.2 Add `compare_energy_plan_rates` with validation (count, unknown ids, fuel, distributor, current plan). Tests cover each refusal
- [x] 1.3 Render the rows (seasonal, block and multi-shoulder plans included) and the `show_comparison` payload with no recommendation. Add a test that no yearly cost or rank appears
- [x] 1.4 Register the tool on the energy vertical with title, readOnlyHint, destructiveHint and openWorldHint set
- [x] 1.5 Add to the instructions and energy skill when to use it: named plans with no usage, and a business with no bill or readings
- [x] 1.6 Add eval prompts: two named plans head to head, a business with no usage, and plans on two distributors

Note: seasonal, block (gas) and several-band plans are handled by the shared view; tests cover block-rate gas and single-rate plans, and the long-row listing (more than four entries) is exercised only by the code path, not a fixture with five or more bands.

## 2. Before shipping

- [ ] 2.1 Run the new prompts on the WSL against real data and check every rate against the plan's Energy Made Easy rate sheet for two plans
- [ ] 2.2 Check the CDR plan data licence (rule 2.6) is still current
