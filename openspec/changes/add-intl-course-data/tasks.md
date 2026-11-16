## 1. Verify the source

- [x] 1.1 Download the current CRICOS XLSX from data.gov.au on a machine that can reach it, list its sheets and columns in `docs/cricos-columns.md`, and mark which expected fields (level, duration, tuition fee, non-tuition fee, language, work component, locations, provider website, expiry) are present
- [x] 1.2 Record a small fixture under `test/fixtures/cricos/` for tests (synthetic rows in the real export layout, in `real-layout/`, plus a single-sheet sample; no real rows are committed)
- [x] 1.3 Update the proposal and this design with any field that turned out absent

## 2. Schema and loader

- [x] 2.1 Add migration `0004-intl.ts` with `intl_providers`, `intl_courses`, `intl_course_locations` and `intl_load`, under the `askrighto` schema
- [x] 2.2 Extend the CRICOS parser in `src/courses/cricos.ts` (or a shared module) to stream the national file and map the verified columns (parser skips the two title rows and takes the Courses sheet, with optional Course Locations and Institutions sheets joined in)
- [x] 2.3 Implement `intl:validate` (row counts by level, rows with no fee, rows with no duration, duplicate course codes) and `intl:load` (single transaction, replaces all rows, records source file and date)
- [x] 2.4 Link rows to domestic `courses` through `cricos_code` where both exist (resolved at read time by a join on `courses.cricos_code`, so it never goes stale)

## 3. Labelling and guidance

- [x] 3.1 Add the fee label, as-of date and CRICOS attribution to every returned record
- [x] 3.2 Seed provider page links and write the reading checklist (English entry, scholarships, intakes, country requirements) for the browsing assistant (provider links come from the website column when the file has one; no hand-seeded list)

## 4. Vertical and gate

- [x] 4.1 Add `international` to `KNOWN_VERTICALS`, register its readiness check, keep it out of `ASKRIGHTO_PUBLIC_VERTICALS` by default
- [x] 4.2 Tests: parser on the fixture, load idempotence, level filter, null handling, link to domestic rows, `data_unavailable` when the rights entry is not cleared
- [x] 4.3 Document in `docs/intl-course-data.md`
