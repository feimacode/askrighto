## 1. Verify the source

- [ ] 1.1 Download the latest ZIP from data.gov.au on a machine that can reach it (cloud sessions are blocked), list its files, XML elements and CSV columns in `docs/health-cover-columns.md`, and mark which expected fields are present (insurer, product, state, household type, age band, hospital tier, premium by frequency, premium before and after rebate, excess type and amount, clinical categories, general treatment services and limits, waiting periods, hospital agreements, PHIS page link)
- [ ] 1.2 Read the ZIP's `Readme.txt` and record any attribution or reuse wording
- [ ] 1.3 Read the privatehealth.gov.au terms of use and record in `docs/data-rights.md` exactly what they say about reuse of the site (the dataset is covered by CC BY; the site is not assumed to be)
- [ ] 1.4 Check the CC BY 3.0 AU licence on the data.gov.au record is still current before shipping
- [x] 1.5 Add a small synthetic fixture under `test/fixtures/health/` in the real file layout (no real insurer rows committed)
- [ ] 1.6 Update this design and the proposal with any field that turned out absent

## 2. Schema and loader

- [x] 2.1 Add migration `0005-health.ts` with the `health_*` tables and `health_load`, under the `askrighto` schema
- [x] 2.2 Write a streaming parser for the XML and change CSVs, mapping the verified fields and keeping the file's own tier, category and service codes with the schema version
- [x] 2.3 Implement `health:validate` (insurer and product counts, rows per tier, rows with no premium, duplicate keys, unknown codes) and `health:load` (single transaction, replace all, record file name, date, hash). Built against the assumed layout; `health:load` takes the unzipped folder (`--dir`), since Node has no built-in unzip
- [ ] 2.4 Implement the one-command rollback to the previous load (not built; a bad month is fixed today by loading the previous month's folder again)

## 3. Registry, rights and staleness

- [x] 3.1 Register the dataset (`maxAgeHours` 1080), readiness check and `vertical: health-cover`
- [x] 3.2 Add the `health-cover-products` entry to `src/core/rights.json` and `docs/data-rights.md` (basis `open_licence`, status `cleared_pending_legal_view`, attribution, conditions) and make the sync test pass
- [x] 3.3 Add the staleness warning when the file date is before the latest 1 April or 1 July

## 4. Tests and docs

- [x] 4.1 Tests: parser on the fixture, load idempotence, failed load keeps old rows, null premium stays null, premium-change staleness warning, `data_unavailable` with no data (database tests run only with `TEST_DATABASE_URL`). Not covered: rollback (not built) and the production rights gate for this dataset (the generic gate is tested elsewhere)
- [x] 4.2 Document the monthly operator routine (in `docs/health-cover-columns.md`, with the area doc `docs/areas/health-cover.md`; `docs/deploying.md` gets a pointer)
