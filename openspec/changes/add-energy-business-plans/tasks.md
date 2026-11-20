# Tasks

## 1. Data

- [x] 1.1 Keep `RESIDENTIAL` and `BUSINESS` plans at the list stage (`isSupportedCustomer`); carry the customer type onto the plan; read it back in `rowToPlan` and `renormalise`; verify unit tests for each type and for a missing or other type
- [x] 1.2 Add a `customerType` filter to the store query; verify a test that both types are stored and the filter returns only one
- [ ] 1.3 After deploy, run `sync-energy` once and record the plan counts by customer type

## 2. Tools

- [x] 2.1 Add `customerType` to `search_energy_plans` and `compare_energy_plans`, show the type in all three tools; verify tests that a household sees only residential plans and a business only business plans
- [x] 2.2 Refuse typical usage for a business and stop offering it; add the business assumption line; verify tests
- [x] 2.3 Update server instructions and the energy skill (ask home or business, never assume); verify the instructions test

## 3. Docs and checks

- [x] 3.1 Update `docs/energy-data.md` and `docs/areas/energy-plans.md`; check the energy-plans rights entry still covers business product data (same CDR source)
- [ ] 3.2 Confirm with a real business plan that the CDR detail shape and eligibility text are read as expected, and look at a sample of business plans not estimated and why
