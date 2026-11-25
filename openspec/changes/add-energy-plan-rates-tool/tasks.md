# Tasks

## 1. Build

- [ ] 1.1 Pull the per-plan rate formatting out of `get-energy-plan.ts` into a shared helper. The `get_energy_plan` tests pass unchanged
- [ ] 1.2 Add `compare_energy_plan_rates` with validation (count, unknown ids, fuel, distributor, current plan). Tests cover each refusal
- [ ] 1.3 Render the rows (seasonal, block and multi-shoulder plans included) and the `show_comparison` payload with no recommendation. Add a test that no yearly cost or rank appears
- [ ] 1.4 Register the tool on the energy vertical with title, readOnlyHint, destructiveHint and openWorldHint set
- [ ] 1.5 Add to the instructions and energy skill when to use it: named plans with no usage, and a business with no bill or readings
- [ ] 1.6 Add eval prompts: two named plans head to head, a business with no usage, and plans on two distributors

## 2. Before shipping

- [ ] 2.1 Run the new prompts on the WSL against real data and check every rate against the plan's Energy Made Easy rate sheet for two plans
- [ ] 2.2 Check the CDR plan data licence (rule 2.6) is still current
