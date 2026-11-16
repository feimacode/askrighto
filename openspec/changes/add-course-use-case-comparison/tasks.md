## 1. Coverage report

- [ ] 1.1 Add `src/compare/coverage.ts` with SQL for domestic coverage (rows, depth split, entry figure, prerequisite rule) and international coverage (rows, fee, duration, locations, provider link)
- [ ] 1.2 Add source age and rights status per dataset using the rights register
- [ ] 1.3 Add CLI `compare:usecases` printing a table and `--json`; reads only, no writes
- [ ] 1.4 Tests on fixture data for both sides, including empty tables

## 2. Prompt sets

- [ ] 2.1 Write about 20 domestic prompts in `docs/use-case-comparison/prompts.md` with expected tools and what a grounded answer must contain
- [ ] 2.2 Write about 20 international prompts in the same format, with edge cases (missing fee, expired course, English requirement, visa question)
- [ ] 2.3 Ask Iven to add or replace prompts taken from real questions

## 3. Scorecard and protocol

- [ ] 3.1 Write `docs/use-case-comparison/protocol.md`: set-up on the internal route, counters before and after, which hosts, with and without a browsing assistant
- [ ] 3.2 Write `docs/use-case-comparison/scorecard.md` template with the five measures and a decision section
- [ ] 3.3 Record the draft decision rules and mark them for Iven to confirm

## 4. First run

- [ ] 4.1 After the CRICOS columns are verified and both data sets are loaded, run the report and the prompt sets and fill the first scorecard
- [ ] 4.2 Summarise the comparison and a recommendation for Iven, with the limits of a 20-prompt sample
