## Context

Pattern: `add-intl-course-tools`. Read-only tools, flat input schemas, `title`, `readOnlyHint`, `destructiveHint` and `openWorldHint` set, verb-first names. Tools query the `career_*` tables only.

## Decisions

1. **Grounded envelope.** Each result returns the value, `source` (JSA, dataset or page URL), `asOf` (release date), `referencePeriod` and the attribution string from the rights register, or `found: false` with a reason. The host narrates; the server never states an outlook it did not read.
2. **Outlook is the publisher's figure.** `get_occupation_outlook` returns projected employment and growth as published, with the base year and horizon. No ranking words ("great", "safe") come from the server.
3. **Search is plain.** `find_occupations` matches occupation titles and keywords stored in the table; no model-based matching on the server.
4. **Study paths only if stated.** `list_occupation_study_paths` exists only if the publisher states the link. It then returns that statement with its source. Otherwise the host is given the JSA occupation page link and a reading checklist for the user's own browsing assistant (AGENTS.md rule 1).
5. **Tool descriptions say what is not covered:** no salary, no job vacancies, no migration advice.
6. **Visual output.** Table for search results, entity card for one occupation, using the same Inkview helpers as the course tools.
7. **Internal first.** Registered under the `career-outcomes` vertical, served on `/mcp-internal/<token>`; promotion follows the canary gates.

## Risks / Trade-offs

- If JSA has no stated occupation-to-study link, the tool set is only two lookups and the value to course answers is the occupation context, not a join. That is acceptable and honest.
- Occupation titles differ from what students search ("nurse" versus "registered nurse"); search returns several candidates and asks the host to confirm.

## Open Questions

- Does the data change find a stated occupation-to-study link?
- Should a short occupation summary come from the file, or only numbers?

## Implementation notes (18 Nov 2026)

- Two tools built, `find_occupations` and `get_occupation_outlook`. `list_occupation_study_paths` is not built: the file holds a skill level paired with a qualification level, not a field of study. The outlook result shows that level and says it is a level of study.
- Employment is returned in thousands of people as published; percentages are the file's fractions shown as percent (a change of unit only).
- Task 3.3 (course plugin skill line) and 4.2 (use-case prompts) are still open.
