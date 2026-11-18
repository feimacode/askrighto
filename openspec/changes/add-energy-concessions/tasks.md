# Tasks

## 1. Concession rules

- [ ] 1.1 For each covered state (NSW, QLD, SA, TAS, VIC, ACT), read the official electricity and gas concession pages, record the page link, the copyright/licence notice and whether the rule fits `fixedYearly`, `fixedDaily` or `percentOfBill`; write the findings to `docs/energy-concessions.md`. Verify: the doc lists every state with link, licence and kind (or "link only" and why).
- [ ] 1.2 Write `src/energy/concessions.json` with the rules from 1.1 in our own words, and `src/energy/concessions.ts` (load, validate, find by state and fuel, compute the after-concession figure, staleness by 1 July). Verify: unit tests cover each kind, the floor at zero, a stale rule, and one worked example per state where the page publishes one.
- [ ] 1.3 Add a test that fails when any rule's `checkedAt` is before the latest 1 July. Verify: the test passes with current dates and fails when a date is moved back.

## 2. Comparison tool

- [ ] 2.1 Add the postcode-to-state ranges (design) with the border postcodes that need a question. Verify: unit test per range boundary and per border postcode.
- [ ] 2.2 Add `concessionCard` (`yes` | `no`) to `compare_energy_plans`, resolve the postcode's state, and add `costAfterConcessionCents` per estimate and the `concession` block on the result, without changing ordering or totals. Verify: tools tests for yes with a rule, yes without a rule (link only), not said (note and link), and that the order is identical with and without the answer.
- [ ] 2.3 Show the concession in the text output (column plus a line with link and checked date) and in the Inkview table. Verify: tools test on the rendered text; existing Inkview validation passes.
- [ ] 2.4 Update `docs/energy-estimates.md` and `docs/areas/energy-plans.md` for the new input, figure and assumptions. Verify: docs mention the input, the no-reordering rule and the sources.

## 3. Host guidance

- [ ] 3.1 Add the concession question to `src/energy/instructions.ts` and the `energy-bill-comparison` skill and worked example: one yes/no question, never card type or number, "if eligible" wording. Verify: `npm run guidance:check` passes and the skill text contains no request for a card number.

## 4. Release checks

- [ ] 4.1 Before shipping, re-check each state's page licence and that the keyed amounts match the page on the day. Verify: `checkedAt` dates in the JSON are within the last week and `docs/energy-concessions.md` records the licence per state.
