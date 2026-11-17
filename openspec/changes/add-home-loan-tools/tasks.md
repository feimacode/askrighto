## 1. Search and lookup

- [ ] 1.1 Implement `search_home_loans` with the filters in design.md, user-chosen sort only, a limit cap, and the coverage block (lenders in list, lenders answering, matches, excluded and why); verify tests for no sort (alphabetical, stated), each sort, an LVR figure outside every tier (listed as no published rate), a tailored product, an `understood: false` product and an empty result
- [ ] 1.2 Implement `get_home_loan` by lender and product id including all rates, tiers, fees, features, constraints and links; verify tests for found, unknown product, expired product (labelled) and a not-understood product (raw rates plus notice)
- [ ] 1.3 Implement `compare_home_loans` for two to five products, with the matched rate per product and a note when products are not comparable (different purposes or repayment types); verify tests including a comparison that mixes owner-occupier and investor rates

## 2. Calculator

- [ ] 2.1 Implement `src/homeloans/calc.ts` in integer cents: amortised and interest-only payments for monthly, fortnightly and weekly, total interest, optional extra repayment, simple offset model; verify golden tests against published worked examples (record each example's source) and property tests that the balance reaches zero and interest is never negative
- [ ] 2.2 Implement `calculate_home_loan_repayments` with the two rate sources, labels and the "not modelled" list; verify tests for a stored-product rate, a user rate (no source claim), a fixed rate shorter than the term, an offset on a product without the feature (`needs_input`) and an amount or term outside sane bounds (rejected with a message)
- [ ] 2.3 Check that no tool output contains a figure that is neither stored, user-supplied nor labelled as calculated; verify with a test that scans outputs on the fixture set

## 3. Reference rate

- [ ] 3.1 Implement `get_home_loan_reference_rates` returning the cash rate target, effective date, source URL and attribution; verify a test with no rate loaded returns `no_data_loaded`

## 4. Notices and wording

- [ ] 4.1 Write `src/homeloans/notices.ts` (published-not-offered, comparison rate caveat, coverage, not credit advice) and attach them in the tool wrapper; mark every text draft pending legal view; verify a test that no tool result can be built without them
- [ ] 4.2 Add a banned-wording test over tool descriptions, instructions and rendered text for "best", "recommended", "you should", "approved", "eligible", "cheapest" without a stated measure; verify it fails on a planted example

## 5. Wiring

- [ ] 5.1 Add `home-loans` to `KNOWN_VERTICALS`, register the tools and instructions in `src/server/route.ts`, add Inkview components with a markdown fallback; verify tools are visible on `/mcp-internal/<token>` and absent from `/mcp` unless named in `ASKRIGHTO_PUBLIC_VERTICALS`
- [ ] 5.2 Update `list_data_sources` for both home loan datasets with attribution; verify a smoke test
- [ ] 5.3 Check tool names, annotations and flat schemas pass `validateToolDefinition` (verb-first names, read-only hints)
- [ ] 5.4 Check the CDR and RBA licence terms are still current before shipping and record the date
