# Tasks

## 1. Dates, rules and schemes

- [ ] 1.1 Define the key date, preference rule and early entry scheme types and YAML schemas; verify the typecheck and that they are documented in `docs/vce-admissions-data.md`
- [ ] 1.2 Curate `data/vce/key-dates.yaml` for the 2027 and 2028 admissions years from VCAA and VTAC pages in our own words, with provisional flags; verify validation passes and every date has a source and checked date
- [ ] 1.3 Curate `data/vce/preference-rules.yaml` from the VTAC preferences fact sheet and offers pages in our own words; verify each rule links to its page
- [ ] 1.4 Curate `data/vce/early-entry.yaml` for each VIC university's scheme, starting from the pilot's six, re-read from the scheme pages; verify no eligibility field exists and the page checker finds no 12-word verbatim runs

## 2. Aggregate and scaling

- [ ] 2.1 Port the aggregate counting rule from `vce-subject-planner/apps/api/src/recommendation/atar-aggregate.ts` as a pure function with study roles and not-computed reasons; verify ported golden tests and VTAC's published worked example
- [ ] 2.2 Implement scaled-score lookup with linear interpolation between published points and the outside-range reason; verify tests at, between and outside points
- [ ] 2.3 Build a development copy of the 2025 scaling table and groupings from the pilot JSON into git-ignored `data/local/`; verify it is not tracked by git and the CI check from `add-course-data-permissions` passes
- [ ] 2.4 Write the loader path for a permitted scaling file (`data/vce/scaling-<year>.yaml` or a VTAC-supplied file); verify with the development copy only

## 3. Store and registration

- [ ] 3.1 Add the migration for the admissions tables and `vce_loads`; verify it applies on a fresh schema
- [ ] 3.2 Implement `vce:validate` and `vce:load` per dataset in one transaction each; verify a failed load keeps the previous rows
- [ ] 3.3 Register the five datasets with their rights ids and readiness checks; verify `list_data_sources` shows scaling and groupings as not yet available in production mode

## 4. Licence checks

- [ ] 4.1 Re-read the VCAA and VTAC terms pages and update the rights entries for each dataset before release; verify each entry's read date is current and note it in the pull request
- [ ] 4.2 When VTAC's reply arrives, record it in the permission log and rights register, then enter the scaling table under its conditions; verify the attribution wording appears on aggregate results

## Workflow follow-up

- Archive the change after review so `vce-admissions-data` becomes a main spec.
- SEAS explanations and VCAA school subject availability are later changes.
