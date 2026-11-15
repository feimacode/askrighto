# Tasks

## 1. Model and validation

- [ ] 1.1 Write `data/vce-studies.yaml` (VCAA study names and codes, plus group ids `english-group` and `any-mathematics`) from the current VCAA study list; verify every study the pilot catalogue mentions resolves
- [ ] 1.2 Define the course, entry figure, prerequisite rule and other-criteria types and a schema for the curated YAML; verify the typecheck passes and the schema is documented in `docs/course-data.md`
- [ ] 1.3 Implement `courses:validate` with the rules in design decision 7, including the TAC-domain and pilot-CSV checks; verify a failing fixture for each rule and that it runs in CI

## 2. Store

- [ ] 2.1 Add the migration for `providers`, `courses`, `course_campuses`, `course_entry_figures`, `course_prerequisites`, `cricos_courses` and `course_loads` with the indexes in the design; verify it applies and rolls forward on a fresh schema
- [ ] 2.2 Implement `courses:load` (validate, replace in one transaction, record commit and counts); verify tests that a failed load leaves the previous set and that a second load of the same commit changes nothing
- [ ] 2.3 Implement the store query functions the tools need (by id, by name and field, by provider, figures by year, prerequisites by applies-to year); verify unit tests against a fixture load
- [ ] 2.4 Register `vic-courses` and `cricos` datasets and a readiness check; verify `/readyz` reports not ready before the first load and ready after

## 3. CRICOS

- [ ] 3.1 Implement the monthly CRICOS download from data.gov.au into `cricos_courses`, with the CC BY attribution on the dataset; verify the dataset file format against a real download (not yet tested) and record a fixture
- [ ] 3.2 Add the cross-check warnings and the uncurated-courses gap report; verify tests with a fixture mismatch

## 4. Curation

- [ ] 4.1 Implement `courses:check-pages` (rate-limited fetch of cited URLs, redirect and 404 report, 12-word verbatim run check, "check by hand" for script-rendered pages); verify it never writes to the curated files
- [ ] 4.2 Rebuild the pilot's 109 courses from their official pages into `data/courses/vic/*.yaml`, with figures labelled by kind, intake year and campus and structured prerequisites; verify validation passes, the page checker shows no verbatim runs, and a second person has spot-checked at least one course per university
- [ ] 4.3 Write the curation guide in `docs/course-data.md` (how to read a course page, which figure is which kind, how to write rules, annual re-check steps); verify a new curator can add one course from it
- [ ] 4.4 Agree the launch coverage target with Iven and widen coverage by field from the gap report; verify the count in the load report meets the target

## 5. Licence and release checks

- [ ] 5.1 Confirm the rights register entries for VIC university pages and CRICOS are current (terms pages re-read, CRICOS licence still CC BY 2.5 AU) before the first production load; note it in the pull request
- [ ] 5.2 Run the first production load from the VM and check the load report and `list_data_sources`; note counts in the pull request

## Workflow follow-up

- Archive the change after review so `vic-course-data` becomes a main spec.
- The legal view on re-keyed facts stays a gate before public listing.
- If VTAC or Course Seeker grants permission, a follow-up change can add their data as a further source.
