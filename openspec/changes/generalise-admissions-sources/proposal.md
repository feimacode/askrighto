# Proposal

## Why

The course index now covers universities in Victoria, NSW, the ACT and Queensland (29 providers), but everything about admissions is Victorian and named for it: the tool `get_vce_admissions_sources`, the dataset `vce-admissions-links`, `VCE_SOURCES`, `docs/vce-admissions-data.md`, `docs/areas/vic-courses.md`, and the instruction text "VCE steps apply to Victorian courses only; for NSW, ACT and Queensland give the course links and say Ask Righto has no HSC or QCE guidance yet". A student in Sydney or Brisbane gets the course link and nothing about their own admissions centre. "VCE" is also the wrong name once the tool answers for the HSC or the QCE.

This change makes the admissions source index state-neutral. It stays index-only (`switch-to-index-only`): links and reading checklists, nothing stored, nothing read by the server.

## What Changes

- Rename the tool `get_vce_admissions_sources` to `get_admissions_sources`. It takes `state` (`vic`, `nsw`, `act`, `qld`) and `topic` (`scaling`, `atar-rules`, `key-dates`, `preferences`, `early-entry`, `adjustment-factors`, `subject-rules`, or `all`). Each entry names the admissions centre (VTAC for Victoria, UAC for NSW and the ACT, QTAC for Queensland), the senior secondary certificate (VCE, HSC, the ACT Senior Secondary Certificate, QCE) and the body that publishes its subject rules (VCAA, NESA, the ACT Board of Senior Secondary Studies, QCAA).
- Rename the dataset `vce-admissions-links` to `admissions-links`, its rights entry and its docs section. `vce-scaling` stays as the `withdrawn` record.
- Replace `VCE_SOURCES` with a table keyed by state and topic, with the same shape as today (title, publisher, url, kind, reading checklist, `indexedOn`, `checkedOn`). Every new link starts unconfirmed and results carry the existing unverified warning until a person opens it.
- Add two topics beyond the Victorian five: `adjustment-factors` (the centre's bonus or adjustment schemes for disadvantage, the names differ by state) and `subject-rules` (where the certificate authority lists subjects, prerequisites or assumed knowledge, for the agent to read).
- Say in each result which numbers are comparable: an ATAR is a national rank, but an aggregate, a selection rank and an adjusted rank are not interchangeable between states. The tool never converts one into another.
- Let `get_domestic_course` and `search_domestic_courses` point at the right admissions state for each course, taken from the provider's region folder (`vic`, `nsw-act`, `qld`) and campus state, so the host does not have to guess which centre to read.
- Generalise the course instructions, the coverage report heading ("DOMESTIC (VIC universities, VCE entry)"), the eval prompts that name the old tool, and the docs. `sources:check` covers every link.

Out of scope: any stored scaling, dates, aggregate or ATAR data (see `switch-to-index-only`); other states (South Australia, Western Australia, Tasmania, the Northern Territory) and the International Baccalaureate, which are listed as later work; a calculator for the aggregate (see Open questions); skills, which are the sibling change `extend-domestic-course-skills`.

Hosts affected: the internal route only. Public listing is unchanged (energy only).

## Impact

- Code: `src/courses/sources.ts`, `src/tools/course-tools.ts`, `src/courses/instructions.ts`, `src/courses/cli.ts` (`sources:check`), `src/compare/coverage.ts`, `src/core/rights.json`.
- Docs: `docs/vce-admissions-data.md` becomes `docs/admissions-sources.md`; `docs/areas/vic-courses.md` becomes `docs/areas/domestic-courses.md`; `docs/data-rights.md`, `docs/course-tools.md`, `docs/architecture.md`, `docs/deploying.md`, `ROADMAP.md`.
- Tests and prompts: `test/courses/*`, `test/rights.test.ts`, `docs/use-case-comparison/prompts.md` (D rows that name the old tool).
- No migration: nothing is stored.
