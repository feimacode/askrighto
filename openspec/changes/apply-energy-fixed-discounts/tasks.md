# Tasks

## 1. Survey real discounts

- [ ] 1.1 Write a read-only survey script (`scripts/survey-discounts.mjs`) over stored raw payloads: counts by `methodUType` and `type`, amount ranges, end dates, and the 30 most common description phrasings for `fixedAmount` and `percentOverThreshold`. Run it on the full load and record the results in `docs/energy-estimates.md`. Verify: the doc section exists with counts and phrasings.
- [ ] 1.2 From 1.1, fix the frequency patterns and the GST treatment and record them in the doc. Verify: each pattern has at least one real phrasing listed beside it, or the doc says fixed discounts ship as "shown, not applied" only.

## 2. Normalise

- [ ] 2.1 Keep `usageAmount`, `endDate` and a derived `frequency` on each discount in `normalise.ts` and `types.ts`. Verify: normalise tests for each method, each frequency pattern, an ambiguous description (UNKNOWN) and a missing `usageAmount`.

## 3. Estimate

- [ ] 3.1 Apply fixed and threshold discounts by frequency in `calc.ts`, guaranteed into the ordering cost and conditional into the cost if conditions are met; list UNKNOWN ones with amount and "frequency not published"; drop expired ones and note end dates within 12 months. Verify: calc tests for each spec scenario and that the breakdown still sums to the total.
- [ ] 3.2 Show unknown-frequency discounts and end dates in the compare text output and in `get_energy_plan`. Verify: tools tests on rendered text.
- [ ] 3.3 Dry-run `renormalise-energy` plus estimates on the survey data and record how many plans' estimates change and by how much. Verify: numbers recorded in the PR description.

## 4. Docs and release

- [ ] 4.1 Update `docs/energy-estimates.md` (step 6) and `docs/areas/energy-plans.md`; note in `docs/deploying.md` that `renormalise-energy` is needed after this deploy. Verify: docs updated.
- [ ] 4.2 Before shipping, confirm the CDR product data terms used for the energy data are unchanged (no new data source in this change). Verify: note in the PR.
