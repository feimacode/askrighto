# CRICOS columns: what the real file holds

**Status: not yet verified.** The cloud workspace that wrote the parser cannot reach data.gov.au, so no real CRICOS file has been opened. The parser (`src/intl/parse.ts`) matches column names loosely and the tests use a synthetic sample (`test/fixtures/cricos/intl-sample.csv`, invented codes and providers). This is task 1.1 of `add-intl-course-data`.

## How to fill this in (needs a machine that reaches data.gov.au)

1. Download the current "CRICOS Providers, Courses and Location(s)" XLSX from the CRICOS dataset on data.gov.au (CC BY 2.5 AU). Note the file date shown on the dataset page.
2. Export the courses sheet to CSV. If courses, locations and providers sit on separate sheets, say so below: the loader currently expects one row per course with a locations column, and would need a join step.
3. Run `npm run intl:validate -- --cricos courses.csv`. The report lists `columnsFound` and `columnsMissing`.
4. Fill in the table.

| Field we expect | Present? | Real column name | Notes (format, units, blanks) |
| --- | --- | --- | --- |
| CRICOS course code | | | |
| CRICOS provider code | | | |
| Provider name | | | |
| Provider website | | | |
| Course name | | | |
| Course level | | | which level names appear |
| Field of education | | | |
| Duration (weeks) | | | |
| Tuition fee (total) | | | per course, per year or per unit? |
| Non-tuition fee | | | |
| Language of instruction | | | |
| Work component | | | |
| Expiry | | | |
| Locations (state, campus) | | | separate sheet? |

## If a field is absent

Drop the matching requirement or move it to the reading checklist, update the proposal and design of `add-intl-course-data`, and record the finding in the use-case comparison scorecard.
