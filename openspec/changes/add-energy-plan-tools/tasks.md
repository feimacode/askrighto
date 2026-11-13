# Tasks

## 1. Cost calculator

- [ ] 1.1 Define the `Usage`, `Estimate` and `NotEstimated` types and the not-estimated reason enum; verify the typecheck passes and the types are covered in `docs/energy-estimates.md`
- [ ] 1.2 Implement supply charge, single-rate and block-rate usage across tariff periods with integer money and one final rounding; verify hand-worked golden tests for a single-rate plan, a two-block plan and a seasonal plan from the fixtures
- [ ] 1.3 Implement time-of-use with supplied shares, including the no-shoulder case; verify golden tests and that a missing split yields `needs_time_of_use_split`
- [ ] 1.4 Implement controlled load, solar feed-in credit, unconditional and conditional discounts, recurring fees and GST by `gstBasis`; verify golden tests for each and that `gstBasis: UNKNOWN` yields `gst_basis_unknown`
- [ ] 1.5 Return not-estimated for demand tariffs, plans not fully understood and missing rates; verify a test for each reason
- [ ] 1.6 Add a property test that the breakdown components always sum to the total and that identical inputs give identical output; verify it passes over all fixture plans
- [ ] 1.7 Check three fixture plans against the retailer's own published cost estimate or fact sheet and record the comparison in `docs/energy-estimates.md`; verify differences are explained or fixed

## 2. Lookup tools

- [ ] 2.1 Implement `search_energy_plans` with filters, paging, neutral ordering, distributor grouping and retailer name matching; verify unit tests for each scenario in the `energy-plan-lookup` spec, including invalid postcode and outside coverage
- [ ] 2.2 Implement `get_energy_plan` with GST-inclusive display, conditions attached to discounts and the not-fully-understood case; verify unit tests for a known plan, an unknown id and a flagged plan
- [ ] 2.3 Add the standard notice module and apply it to both tools; verify a test fails if any energy result lacks the notice in either form

## 3. Comparison tool

- [ ] 3.1 Implement `compare_energy_plans` input handling: yearly or bill-based usage, gas in MJ, share validation, the no-usage error and the several-distributors response; verify unit tests for each input scenario in the `energy-plan-comparison` spec
- [ ] 3.2 Implement ordering by cost without conditional discounts, tie-breaks, the not-estimated list, counts, assumptions and omissions, and eligibility restrictions beside each plan; verify unit tests for ordering, ties, counts and wording with no "best" or "recommended"
- [ ] 3.3 Implement narrowing by plan ids, retailer, distributor, plan type and limit; verify unit tests

## 4. Presentation

- [ ] 4.1 Add `@feimacode/inkview-sdk`, register the Inkview view and write the render module mapping search, detail and comparison results to Inkview table, entity card and comparison with the grounded source; verify the SDK is published at the pinned version and render tests produce both the component payload and markdown
- [ ] 4.2 Extend server instructions with the energy guidance; verify the smoke test finds the guidance in `initialize`
- [ ] 4.3 Write `docs/energy-estimates.md` (how estimates are calculated, assumptions, what is left out) and add example prompts to `README.md`; verify each example prompt maps to a passing smoke test call

## 5. Integration and licence checks

- [ ] 5.1 Add MCP smoke tests that call all three tools over HTTP against a PostgreSQL loaded with the fixtures and check annotations, source, as-of date and notice; verify they pass in CI
- [ ] 5.2 Connect the local server to Claude and ChatGPT developer mode through a tunnel and run five prompts (search, detail, compare with yearly usage, compare with a time-of-use split, "which should I pick?"); record screenshots and any host misbehaviour in the pull request
- [ ] 5.3 Confirm the data change's licence check (rule 2.6, AER page) is still current and that `gstBasis` is confirmed, not `UNKNOWN`, before merging; note both in the pull request

## Workflow follow-up

- Archive the change after review so `energy-plan-lookup` and `energy-plan-comparison` become main specs.
- The legal view on energy comparison obligations remains a gate before public listing.
