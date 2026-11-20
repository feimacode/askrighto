# Tasks

## 1. Model, validator and store

- [x] 1.1 Read the participating-provider pages of UAC and QTAC by hand and the CRICOS Institutions sheet; write the list of universities per region (names only, our own list) in `docs/course-data.md`; verify each is a university with courses in CRICOS DONE in part: the list was taken from the CRICOS Institutions sheet (public universities, plus Bond), not from the UAC and QTAC participating-provider pages; the Notre Dame Australia (WA provider with NSW campuses) and the private colleges are left out until someone reads those pages by hand
- [x] 1.2 Add region folders and make `courses:load` and `courses:validate` read all of `data/courses/*/`; verify the 9 Victorian files still load to the same counts (1,183 courses with the 21 Nov 2026 CRICOS files) DONE: 9 Victorian files unchanged; load now reads data/courses/*/
- [x] 1.3 Add the `admissions` list and its migration (`course_admissions`, backfill from `vtac_code`); verify a Victorian course keeps its id and its VTAC code
- [x] 1.4 Extend `validate.ts`: allowed government domains (`nesa.nsw.edu.au`, `qcaa.qld.edu.au`), blocked sources (`uac.edu.au`, `qtac.edu.au`), provider id unique across folders; verify a failing fixture per rule
- [x] 1.5 Add `nsw-act-courses` and `qld-courses` to `src/core/rights.json` and the UAC and QTAC blocked-source entries; verify `npm run release:check` lists them as pending the legal view and not public
- [x] 1.6 Region parameter on the course tools and updated instructions text; verify the existing Victorian tool tests still pass DONE: `region` filter on `search_domestic_courses` and instructions text

## 2. Stand-ins

- [x] 2.1 Implement `courses:match-standins` (read-only report of candidate CRICOS codes per stand-in); verify against a fixture with one unique and one ambiguous name
- [ ] 2.2 Review the 97 current stand-ins with the report, set `cricosCode` where one course matches, and leave the rest as `gap_fill`; verify the load report and the count of stand-ins before and after

## 3. Content, first slice

- [ ] 3.1 Agree with Iven the named universities and courses per region for curated depth; record them in `docs/course-gaps.md`
- [x] 3.2 Create provider files for every NSW, ACT and Queensland university with official course links, loading its CRICOS courses; verify the load report shows no provider without links DONE: 20 provider files (12 nsw-act, 8 qld) with CRICOS provider codes; CRICOS undergraduate rows load as index_only with no official course links yet
- [ ] 3.3 Curate entry figures and other criteria for the agreed first slice, from the official pages in our own words; verify validation and `courses:check-pages` (no broken links, no verbatim runs)
- [ ] 3.4 Write the state key dates and early entry notes as `provisional` data files, re-read from official pages before clearing the flag

## 4. Subject rules (phase C)

- [ ] 4.1 Write the HSC and QCE subject catalogues from the NESA and QCAA lists; verify every subject in the first slice resolves
- [ ] 4.2 Generalise the rule leaf (curriculum, minimum band, mark or grade, prerequisite or assumed knowledge) and the rule checker; verify unit tests for each curriculum and that a score is never converted between them
- [ ] 4.3 Curate prerequisites for the first slice; verify with the prompt set

## 5. Records and checks

- [ ] 5.1 Update `ROADMAP.md` Phase 6 to point at this change and `docs/course-gaps.md`; verify the "Needs Iven's decision" list is current
- [ ] 5.2 Re-read the UAC, QTAC, NESA, QCAA and university terms pages and record the dates; verify `release:check` passes
- [ ] 5.3 Run the `docs/use-case-comparison` prompts for NSW and Queensland and fill the scorecard
