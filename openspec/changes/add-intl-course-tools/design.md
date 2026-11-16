## Context

The domestic tools (`add-vic-course-tools`) answer "does this student's VCE fit this course". The international user asks a different shape of question: "show me master's courses in data science in Melbourne or Sydney under about AUD 45,000 a year". The tool set is smaller and has no scoring step.

## Decisions

1. **Four tools, no recommendation engine.** Search is a filtered list; compare is a side-by-side of facts. Ranking by fee or duration is a user-chosen sort, not our judgement (AGENTS.md rule 5).
2. **`search_intl_courses`** inputs: free text, level, field of education, state, city or campus, maximum total fee, maximum duration in weeks, provider; page size capped. Returns course name, provider, level, duration, indicative fee, locations, CRICOS code and a link to the provider's page where we have one.
3. **`get_intl_course`** by CRICOS course code (and optional provider). Returns all stored fields plus the domestic link if present.
4. **`compare_intl_courses`** 2 to 5 codes; renders with `inkview.comparison`; criteria are the stored fields only. Per-year fee is shown only when both total fee and duration are published and the figure is labelled "calculated: total fee divided by duration", otherwise omitted.
5. **`get_intl_entry_checklist`** returns the provider page link, the list of things to read (English test and scores, academic entry by country, intake dates, scholarships, course fee on the provider page) and the labelling rule for what the assistant reads. It never fetches pages.
6. **Not-found outcomes** reuse the envelope reasons: `not_in_dataset`, `no_data_loaded`, `data_unavailable`, `needs_input`. A course the register lists as expired is returned with an expired label rather than hidden.
7. **Vertical.** Registered as `international` in `src/server/route.ts`; instructions text tells the host this vertical gives course facts only and no migration advice.
8. **Counters.** Existing metadata-only counters are reused; outcome label per tool. No arguments are logged, so no user profile can form.

## Risks / Trade-offs

- A free-text search over a large table needs an index; use `pg_trgm` only if the shared instance allows the extension, otherwise a simple `ILIKE` on a normalised name column with a statement timeout.
- Fee filters on a field that may be sparsely filled could mislead; every result states how many matches had no published fee.

## Open Questions

- Should search accept a country of origin to select which provider page checklist items matter, even though we store nothing about it?
