# Tasks

- [ ] 1. Open each state's admissions, scaling, dates, preferences, adjustment and subject-rules pages (VTAC, UAC, QTAC, VCAA, NESA, the ACT Board, QCAA) from a machine that reaches them; confirm the table in the design, record `checkedOn`, and note any page that blocks a reader (never get past a bot check)
- [x] 2. Replace `VCE_SOURCES` with the state-keyed table in `src/courses/sources.ts`, with `centre`, `certificate` and `figureKinds`
- [x] 3. Add `get_admissions_sources` (state, topic, `needs_input` when state is missing); remove `get_vce_admissions_sources`
- [x] 4. Return `admissionsStates` from `get_domestic_course` (search results are unchanged: the hint is per course, not per row)
- [x] 5. Rename the dataset, rights entry and docs section; update `coverage.ts` and its heading
- [x] 6. Generalise `COURSE_INSTRUCTIONS` and the unverified warning text
- [x] 7. Extend `sources:check` to every entry and report missing `checkedOn`
- [x] 8. Update tests and the D-row eval prompts that name the old tool; add prompts for NSW, ACT and Queensland (`arg:get_admissions_sources.state=nsw` and so on)
- [x] 9. Rename and update docs (`admissions-sources.md`, `areas/domestic-courses.md`, `data-rights.md`, `course-tools.md`, `architecture.md`, `deploying.md`, `ROADMAP.md`)
- [x] 10. Run lint, typecheck, `npm test`, `guidance:check`, `plugin:check`
