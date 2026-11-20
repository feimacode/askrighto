# Proposal

## Why

`add-intl-course-data` loads only higher-education levels from the CRICOS register and leaves its scope as an open question: whether diplomas, advanced diplomas and VET are in. Iven decided on 20 Nov 2026 that they are. People applying from overseas, or switching course while in Australia, often look at a diploma pathway into a degree or a vocational certificate, and the register already holds those courses with fees, durations and locations.

In the 1 Oct 2026 file (read on 21 Nov 2026) the levels left out are: Diploma 4,180; Advanced Diploma 1,666 (together the 5,846 courses the earlier notes counted); Certificate IV 1,976; Certificate III 2,413; Certificate II 102; Certificate I 6; Vocational Short Course 39; Non AQF Award 1,707; and school levels (Senior Secondary 326, Primary 246, Junior Secondary 241). The certificates are VET too, so "diplomas and VET" adds 10,343 courses (5,846 plus 4,497), taking the store from 13,069 to 23,412.

## What Changes

- Widen the level rule (`levelGroupOf` in `src/intl/parse.ts`) to also keep Diploma, Advanced Diploma and Certificate I to IV. Add six level groups to `LEVEL_GROUPS`: `diploma`, `advanced_diploma`, `certificate_i`, `certificate_ii`, `certificate_iii`, `certificate_iv`.
- Add a `sector` label to each course (`higher_education` or `vet`), derived from the level, so a search can ask for one or the other. A Diploma or Advanced Diploma is `vet` when CRICOS gives it a VET National Code and `higher_education` when it does not, because some diplomas are higher-education awards; the stored sector says which the register states and never guesses when the code is blank for a VET-looking level (then `sector` is left unset).
- Store the VET National Code as published, with a link to the official training.gov.au page for it in the reading checklist (the host's browsing assistant reads that page; nothing from it is stored).
- Keep excluded: school-level courses, Non AQF Award and Vocational Short Course. The first two carry welfare and age rules and unclear scope; the short courses are tiny and not awards. They are still counted in the validation report. Changing that later is again one function.
- Update the tool descriptions and wording that say "higher-education" so they stay true: search says which sectors it covers, and each result shows its sector.
- Re-run the load on the 1 Oct 2026 file and record the new counts; update `docs/cricos-columns.md`, `docs/areas/international-courses.md` and `docs/course-gaps.md`.

Data source: unchanged (CRICOS on data.gov.au, CC BY 2.5 AU, the rights entry `cricos`, attribution on every record).

Hosts affected: the existing international course tools return more courses and accept more level values; no new tool.

Out of scope:

- School-level, Non AQF and Vocational Short Course courses, ELICOS, visa, migration or welfare advice, and entry requirements (still reached through the browsing checklist).
- Linking VET courses to the domestic course index (diplomas do not appear there).
- Fee or duration inference: a null stays null.

## Capabilities

### New Capabilities

- `intl-course-levels`: which CRICOS levels the international course store keeps, how diplomas, advanced diplomas and VET certificates are grouped and labelled by sector, and what stays excluded.

### Modified Capabilities

- `intl-course-data`: its "Levels in scope" requirement is changed here; since that capability is not yet archived into `openspec/specs/`, the change is stated on the new capability and reconciled when the earlier change is archived.

## Impact

- Code: `src/intl/types.ts` (`LEVEL_GROUPS`), `src/intl/parse.ts` (`levelGroupOf`, a `sector` and a `vetNationalCode` field), `src/intl/load.ts` and a migration for the two new columns, `src/tools/intl-tools.ts` (descriptions, result fields), `src/compare/coverage.ts` (level counts), fixtures and tests.
- Data: a reload of `intl_courses` from the 1 Oct 2026 file (all rows are replaced in one transaction).
- Docs: `docs/cricos-columns.md`, `docs/areas/international-courses.md`, `docs/course-gaps.md`.
