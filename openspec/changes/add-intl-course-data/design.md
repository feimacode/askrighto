## Context

`add-vic-course-data` already ingests CRICOS for Victoria as a base index for domestic courses (`cricos_raw` table, parser in `src/courses/cricos.ts`, column names matched loosely and tested on fixtures only). The international case needs the whole register and more of its columns, with a different user question: "which course, where, how long, how much", not "does my VCE fit".

## Decisions

1. **Separate tables, shared source.** `intl_courses` is not the domestic `courses` table. Domestic rows carry admissions facts and a depth flag; international rows carry fees, duration and locations and are never `index_only`. Mixing them would force every domestic query to filter and would blur the rights story. Both read the same `cricos_raw` rows and link by `cricos_code`.
2. **National scope.** International students choose across states; a VIC-only index would make the comparison with domestic unfair in the wrong direction. Cost is a bigger load (tens of thousands of course-location rows), well within one small Postgres.
3. **Higher education first.** Levels loaded: associate degree, bachelor, graduate certificate, graduate diploma, master (coursework and research), doctorate. Diploma/advanced diploma, VET, schools and ELICOS are an open question; the loader keeps a `level` column so they can be added without a reload design change.
4. **Fields as published, never inferred.** Duration in weeks, total tuition fee and non-tuition fee as the file states them. A null stays null and tools say "not published". Fees are labelled "indicative, as published in CRICOS, file dated <date>" and carry the CC BY attribution text from the rights register.
5. **Verify columns first.** Task 1.1 opens a real file and writes `docs/cricos-columns.md`. If a field the proposal expects is absent (for example fees live in a separate sheet or are not published), the affected requirement is dropped or moved to a reading checklist, and the comparison change records that finding.
6. **What CRICOS lacks goes to the user's browsing assistant.** English test scores, entry requirements by country, scholarships and intake dates are read from the official provider page by the user's assistant, quoted with link and time, never stored (AGENTS.md rule 1). Provider page links come from our own link table seeded from CRICOS provider websites where published.
7. **Rebuildable.** `intl:load` replaces all rows from the file inside one transaction; the source file name and date are stored in a `intl_load` row.
8. **Under-18 and school-level courses excluded.** They carry guardianship and welfare rules we do not want to summarise.
9. **Rights.** Reuse the cleared `cricos` entry. Add the attribution text to every tool result. No change to the production gate.

## Risks / Trade-offs

- Column assumptions may be wrong; mitigated by decision 5.
- CRICOS fees can be out of date relative to provider sites; mitigated by labelling and by a reading checklist that tells the assistant to check the provider page.
- A national load is larger than the VIC one; mitigated by a streaming parser and a transaction per load.

## Open Questions

- Include diploma, advanced diploma and VET levels at launch?
- Do we expose research degrees (master by research, doctorate), where "course" is less meaningful?
- Which country-of-origin facts, if any, may be stated (we say none for now)?
