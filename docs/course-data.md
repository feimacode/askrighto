# Course data: schema and curation guide

Course data lives in `data/courses/vic/<university>.yaml`, one file per university, reviewed through pull requests. `npm run courses:validate` checks every rule below and runs in CI; `courses:load` loads the database; `courses:check-pages` lists link problems (it fetches at most one page a second, never writes a file, and reports any run of 12 or more words our summary or prerequisite text shares with the official page).

## Two depths, one table

- **index_only**: a course we list with its name, university, links and (from CRICOS) campuses, duration and code. No entry figures or prerequisites. Tools return links and a reading checklist and say so.
- **curated**: an index row that also holds a summary and checked facts in our own words.

`origin` is `cricos` (the row comes from the CRICOS course list) or `gap_fill` (a domestic-only course CRICOS does not list, with `foundAt` saying where it is listed). The rows now in `data/courses/vic/` are `gap_fill` stand-ins built from course names and official university links in the earlier pilot, because the CRICOS file has not been downloaded in this repo yet. Run `courses:load --cricos FILE.csv [--course-locations FILE.csv]` (CRICOS Courses sheet exported to CSV, plus the Course Locations sheet so CRICOS-origin rows get campuses; the parser matches columns loosely and has not been tested against a real download) to bring official names and codes in, then retire the stand-ins that match.

## File shape

See the fixture in `test/courses/helpers.ts` and `data/courses/vic/rmit.yaml` (one curated course). Provider block: `id`, `name`, `coursesUrl`, `searchUrl`, `domains` (the university's own domains), optional `cricosProviderCode`.

Curated course fields: `id` (stable, ours), `name`, `level`, `fields`, `campuses`, `durationYears`, `cricosCode`, `vtacCode`, `summary` (our words, at most 60 words), `officialUrl`, `entryFigures`, `prerequisites`, `otherCriteria`, `checkedBy`.

## Rules the validator enforces

- Figure `kind` is one of `lowest_atar`, `lowest_selection_rank`, `guaranteed_atar`, `entry_threshold`, `median_atar`; value 0 to 99.95; intake year within the last three years or next two; source URL and checked date.
- Source URLs are on the university's own domains or `education.gov.au`, `data.gov.au`, `vcaa.vic.edu.au`. A source on `vtac.edu.au` or `courseseeker.edu.au` fails while its rights status is not `cleared`. Links (`officialUrl`, `courseSeekerUrl`) may point to those sites; no content is taken from them.
- Prerequisite rule leaves name a study or group id from `data/vce-studies.yaml`; each block has `appliesToYear`, a `text` paraphrase, `sourceUrl` and `checkedOn`.
- No banned phrase ("chance", "you will get in", "best course", "recommended") in summaries.
- No duplicate ids; a gap_fill row needs `foundAt`; no CSV files under `data/` (the pilot's scraped VTAC CSVs must not ship).

## How to read a course page

1. Find the figure and its label. "Lowest selection rank" includes adjustment factors; "lowest ATAR" does not; "guaranteed ATAR" is a promise for an intake year; a published "minimum" is a threshold, not an outcome. Record the intake year the figure is for and the campus.
2. Prerequisites: write the rule as a tree (`allOf` is the list; `anyOf` for alternatives). English with a different EAL minimum is `{ study: english-group, minScore: 25, ealMinScore: 30 }`. Anything not expressible (recommended background) goes in `otherCriteria` as `recommended`.
3. Write the summary in your own words. Do not copy a run of 12 or more words from the page.
4. Set `checkedOn` to the day you read it and `checkedBy` to your name.

## Annual re-check

Each March and August: run `courses:check-pages`, re-read each curated course's page, update figures for the new intake and the prerequisites for the next `appliesToYear`, run `courses:validate`, open a pull request.

## Not done yet

The gap report (`courses:gap-report`) and the full rebuild of the pilot's 109 courses are not implemented or done; see `openspec/changes/add-vic-course-data/tasks.md`.

## Regions, admissions centres and stand-ins (extend-courses-to-uac-qtac, phase A)

- Provider files live in `data/courses/<region>/`, with region one of `vic`, `nsw-act` (UAC) or `qld` (QTAC). A provider id may appear only once across all regions. A university with campuses in several states lives in the folder of its head-office region (ACU stays in `vic/`); campus states are not yet stored separately.
- A course may list `admissions: [{centre: vtac|uac|qtac, code}]`. `vtacCode` still works and is copied into the list. Table `course_admissions` holds them; `vtac_code` stays for older readers.
- `nsw-act/` and `qld/` hold provider entries only so far: the CRICOS undergraduate courses of each provider load as `index_only` rows. `coursesUrl` is the provider's own site from the CRICOS Institutions sheet, and no official course links or curated facts exist yet.
- Sources on uac.edu.au or qtac.edu.au are rejected, like VTAC. nesa.nsw.edu.au and qcaa.qld.edu.au are allowed government sources.
- `courses:match-standins --cricos FILE [--course-locations FILE] [--json]` lists, for each stand-in row, CRICOS courses of the same provider with the same name (`unique`, `ambiguous`, `loose` when only brackets differ, `none`). It changes nothing: a person checks campus and year and sets `cricosCode` on the stand-in. 21 Nov 2026 file: 97 stand-ins, 44 unique, 11 ambiguous, 12 loose, 30 none.
- The ACU `cricosProviderCode` was wrong (00004C); the 1 Oct 2026 file has Australian Catholic University as 00004G, which this change fixes, so ACU now loads its CRICOS courses.
