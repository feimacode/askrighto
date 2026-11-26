# Tasks

## 1. Parser and model

- [x] 1.1 Add the six level groups to `LEVEL_GROUPS` and extend `levelGroupOf` for Diploma, Advanced Diploma and Certificate I to IV (literal matches, no "contains diploma" shortcuts); verify unit tests for each level, for Graduate Diploma still mapping to `graduate_diploma`, and for school levels and Non AQF still excluded
- [x] 1.2 Read the `VET National Code` column; add `vetNationalCode` and `sector` to the parsed course; verify tests for a coded diploma, an uncoded diploma and a certificate
- [x] 1.3 Add the migration for the two columns and update `intl:load` and the store reader; verify a reload on a fresh schema and that `domesticCourseId` is left empty for non-degrees

## 2. Tools

- [x] 2.1 Update the search, get and compare descriptions and results (sector, VET code, "not covered" line) and the level enum; verify the tool schema tests and a search for "certificate iii" and for "diploma"
- [x] 2.2 Update `src/compare/coverage.ts` level counts; verify the coverage report lists the new groups

## 3. Data and records

- [x] 3.1 Reload the 1 Oct 2026 file on `askrighto_dev` (`intl:validate`, then `intl:load --source-date 2026-10-01`); verify 23,412 kept and 1,707 + 39 + school levels excluded
- [x] 3.2 Update `docs/cricos-columns.md`, `docs/areas/international-courses.md` and `docs/course-gaps.md` (decision recorded, counts); verify the open-question wording is gone
- [ ] 3.3 Run the international prompt set for a diploma and a VET question; verify every figure traces to a tool result
