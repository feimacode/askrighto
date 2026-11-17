## 1. Prerequisites

- [x] 1.1 (18 Nov 2026: no field-of-study link is published, only a skill level, so no study-path tool) Confirm `add-career-outcomes-data` is loaded and its column check (task 1.4) says whether a study-path link is published
- [ ] 1.2 Check the data licence and attribution wording in the rights register are still current before shipping

## 2. Tools

- [x] 2.1 Add `find_occupations` with input schema, annotations, and not-found result
- [x] 2.2 Add `get_occupation_outlook` returning published figures with reference period, release date and attribution
- [x] 2.3 (not built: no published link) Add `list_occupation_study_paths` only if 1.1 says the link is published; otherwise return the official page link and a reading checklist
- [x] 2.4 Add Inkview table and entity card output

## 3. Registration and release

- [x] 3.1 Add `career-outcomes` to `KNOWN_VERTICALS` and register the tools in `src/server/route.ts` on the internal route
- [x] 3.2 Add the metadata-only counters used by the other verticals
- [ ] 3.3 Add the skill line to the internal course plugin (quote tool results only, no salary)

## 4. Tests and docs

- [x] 4.1 Tests: every result has source, asOf and attribution; not-found cases; no tool output states salary
- [ ] 4.2 Add 5 prompts to `docs/use-case-comparison/` for outlook and search questions
- [x] 4.3 Update `docs/areas/career-outcomes.md`
