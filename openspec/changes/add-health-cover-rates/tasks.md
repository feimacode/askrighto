## 1. Confirm sources

- [ ] 1.1 Confirm the licence of the ATO rebate, MLS and LHC pages and the Department of Health rebate-change page (look for the site's Creative Commons or copyright notice) and record it in `docs/data-rights.md`
- [ ] 1.2 Re-read the ATO pages and confirm the numbers in `docs/health-cover-research.md` are still current; record each page's own updated date
- [ ] 1.3 Read the ATO MLS exempt excess limits and the LHC base-day and absence rules in full and record them (the research read them only in summary)
- [ ] 1.4 Check whether the proposed 1 April 2027 rebate change has passed Parliament and record its status

## 2. Data and loader

- [ ] 2.1 Write `data/health/rates.yaml` with rebate, MLS, LHC and MLS-exempt-excess rows, each with effective dates, status, source and review date
- [ ] 2.2 Add migration (extend `0005-health.ts`) with `health_rates` and the `health:rates-load` command with validation (no overlapping ranges per family and tier, every row has a source and read date, status values known)
- [ ] 2.3 Implement `src/health/rules.ts` with `rulesAt(date)` that excludes `proposed` rows and reports the rule set it used

## 3. Gates

- [ ] 3.1 Add the `health-cover-rates` rights entry and the `release:check` rule that fails on an overdue `reviewBy`
- [ ] 3.2 Tests: rates change across 1 April and 1 July, a date out of range returns `rules_out_of_range`, a proposed row is never used, overlapping ranges are rejected
- [ ] 3.3 Document the twice-yearly review in `docs/health-cover-rates.md` and add the two dates to the promotion checklist
