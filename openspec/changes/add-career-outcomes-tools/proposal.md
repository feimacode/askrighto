## Why

With JSA occupation data stored (`add-career-outcomes-data`), a student or parent can ask what an occupation looks like and which study leads there, next to the course answers Ask Righto already gives. This is Phase 8 in `ROADMAP.md`.

## What Changes

- Two tools on a new `career-outcomes` vertical: `get_occupation_outlook` (profile facts and projection for an occupation, with reference period) and `find_occupations` (search occupations by name or keyword).
- A third tool, `list_occupation_study_paths`, only if the data change (task 1.4) finds a publisher-stated link from occupation to qualification or field. If none is stated it is not built, and the tools return the official page link instead. We never infer the link.
- Every result carries source, reference period, release date and the JSA attribution, or an explicit not-found.
- Visual results through the Inkview SDK (table, entity card) as for the course tools.
- Internal route only at first, with the same metadata-only counters, outside `ASKRIGHTO_PUBLIC_VERTICALS`.
- A short skill line in the course plugin telling the host to quote only tool results and never state salary, because salary data is not loaded.

Hosts affected: Claude, ChatGPT and Gemini, through the internal route first.

Out of scope: graduate salary (QILT licence unread), job listings, visa and migration advice, personal advice ("you should become..."), our own forecasts.

## Capabilities

### New Capabilities
- `career-outcomes-tools`: the tools, inputs, outputs and limits.

### Modified Capabilities
None.

## Impact

- New `src/tools/career-tools.ts`, `src/careers/instructions.ts`, `src/careers/vertical.ts`; tools registered in `src/server/route.ts` under `career-outcomes`; `KNOWN_VERTICALS` updated.
- Public route unchanged until the promotion gates pass.
