# Tasks

## 1. Register

- [ ] 1.1 Write `docs/data-rights.md` with entries for the energy source (CDR rule 2.6), CRICOS (CC BY 2.5 AU), VIC university course pages (`own_words_facts`), and each VTAC and VCAA source the pilot used, with the terms page URL and the date it was read; verify every entry names owner, basis, status and evidence
- [ ] 1.2 Add `src/core/rights.json` and a loader with the entry type, bases and statuses; verify unit tests reject an unknown basis or status and a missing evidence date
- [ ] 1.3 Add a test that the two register forms list the same dataset ids and that every dataset registered at start-up has an entry; verify it fails on a deliberately missing entry

## 2. Enforcement

- [ ] 2.1 Add a `rights` field to `DataSet` and resolve it at start-up; make production start-up fail on a registered dataset without an entry; verify with a start-up test
- [ ] 2.2 Let tools declare the dataset ids they read, and gate the handler in the tool wrapper so a non-servable dataset yields `data_unavailable` in production and a warning in development; verify tests for each status in both environments
- [ ] 2.3 Show non-servable datasets in `list_data_sources` as not yet available; verify a test
- [ ] 2.4 Apply register attribution to `source.attribution` for every result from that dataset; verify a test fails if a result omits it
- [ ] 2.5 Delete a dataset's records on load when its status is `refused` or `withdrawn`; verify a store test
- [ ] 2.6 Add a CI check that no data file for a `pending`, `refused` or `withdrawn` dataset is committed, and a git-ignored `data/local/` path for development copies; verify the check fails on a test commit

## 3. Permissions and corrections

- [ ] 3.1 Draft the Course Seeker request in `docs/permissions/course-seeker.md` (scope, product description, display, refresh, attribution offer); verify Iven has reviewed it before sending
- [ ] 3.2 Draft the VTAC request in `docs/permissions/vtac.md` (course facts, scaling report table, study area groupings, preference and SEAS rule wording, key dates); verify Iven has reviewed it
- [ ] 3.3 Draft the VCAA request in `docs/permissions/vcaa.md` (key dates; note school subject availability as a later ask); verify Iven has reviewed it
- [ ] 3.4 Create `docs/permissions/log.md` and the corrections process (contact, five business day target, log format); verify the process is linked from `docs/data-rights.md`
- [ ] 3.5 Add the "sources and corrections" page content for askrighto.com.au beside the privacy page; verify the contact address is monitored before launch

## 4. Release checks

- [ ] 4.1 Add a release check that fails when a served dataset is past its review-by date, and warns in the test suite; verify both behaviours
- [ ] 4.2 Add "no `cleared_pending_legal_view` entries" to the public listing checklist; verify it is referenced from the Claude and ChatGPT listing changes
- [ ] 4.3 Re-read every source's terms page before the first course release and update the read dates; verify the licence entries are still current and note it in the pull request

## Workflow follow-up

- Iven sends the requests (Course Seeker first) as soon as the drafts are reviewed; replies are logged as they arrive.
- Phase 6 adds UAC, QTAC and NSW and QLD university entries to the same register.
