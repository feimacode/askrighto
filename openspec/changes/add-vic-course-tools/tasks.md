# Tasks

## 1. Shared pieces

- [ ] 1.1 Add study-name matching with aliases and codes from `data/vce-studies.yaml`, echoing the matched study and returning candidates when ambiguous; verify unit tests for VCAA names, short names ("Methods", "Spesh", "Lit"), codes and an ambiguous name
- [ ] 1.2 Write `src/courses/notice.ts` (standard notice, per-kind figure labels, banned phrases); verify a test that fails when any course result lacks the notice or contains a banned phrase
- [ ] 1.3 Implement the prerequisite evaluator (`met`, `not_met`, `needs_scores`, EAL variants, recommended criteria listed but not evaluated); verify unit tests for each scenario in the `vce-planning` spec and the pilot catalogue's trickiest prerequisite strings

## 2. Lookup tools

- [ ] 2.1 Port the schema of the pilot's `get_course_details` and `get_courses_by_field` into `search_courses` with filters, paging, the studies filter and `figureAtMost`; verify unit tests for each `course-lookup` search scenario
- [ ] 2.2 Implement `get_course` with the entry-year choice and warning; verify tests for a full course, several figure kinds and an earlier-year fallback
- [ ] 2.3 Implement `compare_courses` (2 to 5, mixed-year warning); verify tests
- [ ] 2.4 Implement the two depths: curated facts, or index fields with official and Course Seeker links and the reading checklist (`cannot_check` in comparisons and prerequisite checks), plus `not_in_dataset` with the course search link; verify an index-only result never carries a figure or prerequisite

## 3. Planning tools

- [ ] 3.1 Implement `check_course_prerequisites` with parallel lists and the length check; verify tests for every `vce-planning` prerequisite scenario
- [ ] 3.2 Implement `get_subject_scaling` and `estimate_vce_aggregate` over the admissions data function, declaring `vce-scaling` and `vce-study-groupings`; verify results in development with the local copy and `data_unavailable` in production mode
- [ ] 3.3 Implement `get_vce_key_dates` and `list_early_entry_schemes`; verify the provisional flag and that no eligibility field is returned

## 4. Presentation and guidance

- [ ] 4.1 Write `src/courses/render.ts` mapping results to Inkview table, comparison and entity card with the grounded source, plus markdown; verify render tests for each tool and that `inkview.comparison` is available at the pinned SDK version
- [ ] 4.2 Add the course section to the server instructions, including the guided-browsing rules (university page first, then Course Seeker, never VTAC, checklist items only, label as read by the assistant, never get past a bot check); verify the smoke test finds it in `initialize`
- [ ] 4.3 Add example prompts to `README.md` and a `docs/course-tools.md` page; verify each example maps to a passing smoke test call

## 5. Integration, privacy and licence checks

- [ ] 5.1 Add MCP smoke tests calling all eight tools against a PostgreSQL loaded with fixture courses and admissions data, checking annotations, flat schemas, source, as-of date and notice; verify they pass in CI
- [ ] 5.2 Add a test that no log line or database row contains the studies or scores passed to a planning tool; verify it passes
- [ ] 5.3 Connect the local server to Claude and ChatGPT developer mode through a tunnel and run test prompts: search by field, compare three courses, prerequisite check with and without scores, aggregate (development), an index-only course with the host's browser agent (Claude in Chrome, ChatGPT agent mode) reading the page, a course on a bot-checked site, "will I get into Monash Medicine?", "which subjects should I pick?"; record screenshots and any host misbehaviour in the pull request
- [ ] 5.4 Confirm the rights register entries for every dataset these tools read are current, and that the legal view status is noted, before merging; note both in the pull request

## Workflow follow-up

- Archive the change after review so `course-lookup` and `vce-planning` become main specs.
- Later changes: `add-vtac-preference-tools` (preference list, offer rounds, change of preference), SEAS, school subject availability.
- The legal view and the minors and privacy checks from the listing changes are gates before public listing.
