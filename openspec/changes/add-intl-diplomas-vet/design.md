## Context

`levelGroupOf` maps the register's Course Level text to a level group, or returns undefined to exclude the row. The table column `level_group` is plain text, with no database constraint, so new groups need no schema change for the level itself. `LEVEL_GROUPS` is a zod enum in the search tool, so widening it changes the tool schema: hosts see a longer list of allowed values.

## Decisions

1. **VET means the sector, not one level.** In CRICOS the VET sector is Certificate I to IV, Diploma, Advanced Diploma and Vocational Short Course. We keep all but the short courses. The 1 Oct 2026 numbers: 5,846 diplomas and advanced diplomas, 4,497 certificates, 39 short courses. The short courses and Non AQF Award rows (1,707) stay out: their scope is unclear and they are not qualifications on the AQF.
2. **Six new level groups, not one "vocational" group.** A student asking for a Certificate III in commercial cookery and one asking for a diploma want different things; the register already separates them. Each group is a literal match on the register's text, so an unknown level is excluded and counted, not guessed.
3. **Sector as a stored label, from the register.** Higher education vs VET matters for the user's next step: higher-education awards are applied for through the university; VET through the provider, and a VET qualification has a national code. The code is a column in the Courses sheet (`VET National Code`), which the earlier change noted but did not keep. Store it as published. A row with a code is `vet`. A Diploma or Advanced Diploma with no code stays `sector` unset, not `higher_education`, so the tool says "sector not stated". Certificates are `vet` by definition.
4. **No new entry or fee logic.** Fees, durations and locations are stored as published, with the existing indicative-fee label. Certificates and diplomas often have short durations and no fee in the file; a null stays null.
5. **Schools stay out.** School-level rows (and the under-18 and welfare rules they carry) remain excluded. Certificates are not school-level, but the register has no age column in the data we keep, so tool text says it does not cover age or welfare rules, and the checklist points to the provider's page.
6. **Tool wording.** The tool descriptions currently say "higher-education courses". They are changed to "courses at higher-education and VET level", the level enum lists the six new values, and each result shows `sector`.
7. **Search weight.** Adding 10,343 rows lowers the share of degrees in unfiltered results. Search keeps the existing ranking; the `level` and `sector` filters let the host narrow. No new ranking is invented.
8. **Reload.** `intl:load` already replaces all rows in one transaction; no staged migration of data. The reload is done on `askrighto_dev` first and the count compared with the validation report before any shared database is touched.
9. **Linking.** `domesticCourseId` stays for degrees only. Diplomas and VET courses have no domestic index row; the tool says so rather than leaving the field out silently.

## Risks / Trade-offs

- The `level` enum in the tool schema grows from 6 to 12 values; a host that cached the old schema may reject new values until it refreshes. Mitigated by adding values only, never renaming.
- Sector is unset for some diplomas. Mitigated by saying "not stated" instead of inferring.
- The store grows by about 80 per cent; the number of rows is still small for Postgres.
- VET courses are not "uni courses"; the tool wording changes so a user is not misled into expecting degrees.

## Open Questions

- Should Vocational Short Course (39) and Non AQF Award (1,707) be included later? Default: no.
- Should the checklist link each VET course to its training.gov.au page? Default: yes, as a link only; it is a government page the user's assistant may read.
