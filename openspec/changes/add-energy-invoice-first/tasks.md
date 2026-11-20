# Tasks

## 1. Verify

- [ ] 1.1 Recount, on the data held at the time, the layouts per retailer and network and the share of rate groups with identical hours; verify the figures in the design still hold
- [ ] 1.2 Read three real invoices (Iven's, with identifiers removed) and list which fields each shows, whether band hours are stated, and whether rates include GST; update the extraction list
- [ ] 1.3 Check the GST handling in matching against those invoices

## 2. Build

- [x] 2.1 Add `src/energy/layouts.ts` (layout signature, id, plain-words description); verify unit tests on the stored fixtures
- [x] 2.2 Add `list_current_plan_options` with the fallback; verify tests for merging, ranking with and without GST, customer type, and the layout fallback
  - Done in cloud: `src/energy/layouts.ts`, `src/tools/list-current-plan-options.ts`, `test/energy/layouts.test.ts`, `test/energy/current-plan.test.ts`. Layout times are normalised to HH:MM (the data holds "1500"). Seasonal plans: the option shows the first season's rates; the key covers all seasons.
- [ ] 2.3 Add `currentPlanId` and `hoursLayoutId` to `compare_energy_plans`; verify tests for same hours, different hours, unknown hours and readings given
  - 2.3 waits for the per-band shares change (PR #59), which edits the same `calc.ts` and `compare-energy-plans.ts`, and for the readings layers change in another thread.
- [ ] 2.4 (partly done: invoice-first and pick-list bullets are in the server instructions with a guidance test; the `currentPlanId` and `hoursLayoutId` wording, the skill and tool descriptions wait for 2.3) Update server instructions, tool descriptions and the energy skill: invoice first, fields, confirmation, customer type, identifiers, moving house; verify the instructions test and a test that no tool input takes an identifier
- [ ] 2.5 Add evals and host test prompts for the invoice route (matched, not matched, moving house, business); verify the prompt set runs
- [ ] 2.6 Write `docs/energy-invoice.md` and update `docs/energy-estimates.md`

## 3. Before shipping

- [ ] 3.1 Try the flow with Iven's invoice in each host and record what the agent extracts and asks
- [ ] 3.2 Check the data licence and review-by dates are still current
