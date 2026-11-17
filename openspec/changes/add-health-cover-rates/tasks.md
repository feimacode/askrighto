## 1. Confirm sources

- [ ] 1.1 Confirm the licence of the ATO rebate, MLS and LHC pages and the Department of Health rebate-change page (look for the site's Creative Commons or copyright notice) and record it in `docs/data-rights.md`
- [ ] 1.2 Re-read the ATO pages and confirm the numbers in `docs/health-cover-research.md` are still current; record each page's own updated date
- [ ] 1.3 Read the ATO MLS exempt excess limits and the LHC base-day and absence rules in full and record them (the research read them only in summary)
- [ ] 1.4 Check whether the proposed 1 April 2027 rebate change has passed Parliament and record its status

## 2. Data and loader

- [x] 2.1 Write `data/health/rates.yaml` with rebate, MLS, LHC and MLS-exempt-excess rows, each with effective dates, status, source and review date
- [x] 2.2 Validation of `data/health/rates.yaml` (no overlapping ranges, every row has a source, read date and review date, known status) as `health:rates-validate`. Deviation: no `health_rates` table; the rates are small, git-tracked and read into memory at start, like the course YAML (no overlapping ranges per family and tier, every row has a source and read date, status values known)
- [x] 2.3 Implement `src/health/rules.ts` with `rulesAt(date)` that excludes `proposed` rows and reports the rule set it used

## 3. Gates

- [x] 3.1 Add the `health-cover-rates` rights entry (its `reviewBy` is covered by `release:check`); `health:rates-validate` fails on an overdue row in `rates.yaml`, and `/readyz-internal` reports it
- [x] 3.2 Tests: rates change across 1 April and 1 July, a date out of range returns `rules_out_of_range`, a proposed row is never used, overlapping ranges are rejected
- [x] 3.3 Document the twice-yearly review (in `docs/health-cover-columns.md` and `docs/areas/health-cover.md`) and add it to the promotion checklist
