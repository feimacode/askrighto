## 1. Verify the source

- [x] 1.1 (18 Nov 2026, from FengsPC via WSL; only the employment projections workbook is in scope, see docs/career-outcomes-columns.md) Download the candidate JSA files on a machine that can reach them, list sheets and columns in `docs/career-outcomes-columns.md`, and note classification, reference period and release date; drop frozen or unlicensed datasets
- [x] 1.2 (18 Nov 2026: attribution is "© Commonwealth of Australia"; the labourmarketinsights.gov.au site named earlier does not exist) Read the labourmarketinsights.gov.au copyright page in full and each dataset's own licence; record the required attribution wording in `docs/data-rights.md`
- [ ] 1.3 Check the CC BY 4.0 licence on the site and each dataset is still current before shipping
- [x] 1.4 (18 Nov 2026: skill level only, no field of study) Record whether JSA states any link from occupation to qualification level or field of education
- [x] 1.5 (synthetic xlsx, no real rows) Add a small synthetic fixture under `test/fixtures/careers/` in the real file layout

## 2. Schema and loader

- [x] 2.1 Add a migration with `career_*` tables and `career_load` under the `askrighto` schema
- [x] 2.2 Write the parser for the verified layout, keeping the file's own codes, classification version, units and reference periods
- [x] 2.3 Implement `careers:validate` (occupation counts, rows with no value, duplicate keys, unknown codes) and `careers:load` (single transaction, replace all, record file names, dates, hashes)

## 3. Registry, rights and staleness

- [x] 3.1 Register the dataset with `maxAgeHours`, a readiness check and `vertical: career-outcomes`
- [x] 3.2 Add the `career-outcomes` entry to `src/core/rights.json` and `docs/data-rights.md` and make the sync test pass
- [x] 3.3 Add the staleness warning when the stored release is older than the publisher's current one

## 4. Tests and docs

- [x] 4.1 Tests: parser on the fixture, load idempotence, failed load keeps old rows, null stays null, `data_unavailable` with no data
- [x] 4.2 Document the operator routine in `docs/career-outcomes-columns.md` and add `docs/areas/career-outcomes.md`
