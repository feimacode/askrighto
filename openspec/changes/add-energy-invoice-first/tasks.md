# Tasks

## 1. Verify

- [ ] 1.1 Recount, on the data held at the time, the layouts per retailer and network and the share of rate groups with identical hours; verify the figures in the design still hold
- [ ] 1.2 Read three real invoices (Iven's, with identifiers removed) and list which fields each shows, whether band hours are stated, and whether rates include GST; update the extraction list
- [ ] 1.3 Check the GST handling in matching against those invoices

## 2. Build

- [ ] 2.1 Add `src/energy/layouts.ts` (layout signature, id, plain-words description); verify unit tests on the stored fixtures
- [ ] 2.2 Add `list_current_plan_options` with the fallback; verify tests for merging, ranking with and without GST, customer type, and the layout fallback
- [ ] 2.3 Add `currentPlanId` and `hoursLayoutId` to `compare_energy_plans`; verify tests for same hours, different hours, unknown hours and readings given
- [ ] 2.4 Update server instructions, tool descriptions and the energy skill: invoice first, fields, confirmation, customer type, identifiers, moving house; verify the instructions test and a test that no tool input takes an identifier
- [ ] 2.5 Add evals and host test prompts for the invoice route (matched, not matched, moving house, business); verify the prompt set runs
- [ ] 2.6 Write `docs/energy-invoice.md` and update `docs/energy-estimates.md`

## 3. Before shipping

- [ ] 3.1 Try the flow with Iven's invoice in each host and record what the agent extracts and asks
- [ ] 3.2 Check the data licence and review-by dates are still current
