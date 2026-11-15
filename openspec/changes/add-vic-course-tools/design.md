# Design

## Context

`add-mcp-server-core` supplies `defineTool`, the `Grounded<T>` envelope and the flat-schema rule. `add-course-data-permissions` lets tools declare the datasets they read and gates them in production. `add-vic-course-data` supplies courses with labelled entry figures, structured prerequisite rules by entry year and per-fact source URLs. `add-vce-admissions-data` supplies key dates, preference rules, early entry schemes and the aggregate function, with scaling and groupings gated. The energy tools set the patterns reused here: Inkview rendering with the grounded envelope beside the component, a notice module, neutral wording, and a section of server instructions. See proposal.md for motivation and the two specs for behaviour.

The pilot's `tools.ts` defined nine OpenAI function schemas (`get_course_details`, `get_courses_by_field`, `get_subject_scaling`, `get_school_subject_availability`, `compute_atar_aggregate_impact`, `get_preference_mechanics`, `get_seas_categories`, `get_key_dates`, `get_early_entry_schemes`) called from its own LLM loop. Here the host model calls our tools directly.

## Goals / Non-Goals

**Goals:**

- Tools a host model can chain: search, then detail, compare or check.
- A prerequisite check done by code from structured rules, with a clear "cannot tell" when scores are missing.
- Wording that makes past figures and published rules hard to misread as predictions or advice.

**Non-Goals:**

- Generating and ranking subject combinations (the pilot's `candidates.ts` and `ranking.ts`). It relied on a ranking proxy the pilot itself flagged as weak, and ranking subject choices edges into advice. A host can already ask "which of these courses do my subjects rule out?" through `check_course_prerequisites`. Revisit after launch.
- Preference list building and offer-round helpers (later change).
- School subject availability (VCAA terms not checked).

## Decisions

**1. Eight tools with flat inputs.**

| Tool | Inputs (all scalars or scalar lists) | Reads |
| --- | --- | --- |
| `search_courses` | `query?`, `field?`, `university?`, `campus?`, `vceStudies?` (list), `figureAtMost?`, `limit?` (default 20, max 50), `cursor?` | `vic-courses` |
| `get_course` | `courseId`, `entryYear?` | `vic-courses`, `cricos` |
| `compare_courses` | `courseIds` (2 to 5), `entryYear?` | `vic-courses` |
| `check_course_prerequisites` | `courseIds` (1 to 10), `vceStudies` (list), `studyScores?` (list, same order), `eal?`, `entryYear?` | `vic-courses` |
| `get_subject_scaling` | `study`, `studyYear?` | `vce-scaling` |
| `estimate_vce_aggregate` | `vceStudies` (4 to 6), `studyScores` (same order), `studyYear?` | `vce-scaling`, `vce-study-groupings` |
| `get_vce_key_dates` | `admissionsYear?`, `kind?` (`vcaa`, `vtac`, `all`) | `vce-key-dates`, `vtac-preference-rules` |
| `list_early_entry_schemes` | `university?`, `courseId?`, `admissionsYear?` | `vic-early-entry` |

All are `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`. Studies and scores are parallel lists because Gemini needs flat schemas; the tool fails with `needs_input` when the lengths differ. Alternative: `"Chemistry:35"` strings. Rejected: a second parsing format for hosts to get wrong. Alternative: one `courses` tool with a mode. Rejected for the same reason as energy: atomic verb-first tools select better.

**2. Study names are matched, then echoed.** `vceStudies` accepts VCAA names, common short names ("Methods", "Spesh", "Lit") and codes, matched through `data/vce-studies.yaml` aliases. The matched study is always echoed. An unknown or ambiguous name returns `needs_input` with candidates, never a guess.

**3. Prerequisite evaluation.** `evaluate(rules, studies, scores?, eal) → met | not_met | needs_scores`, per course and per rule leaf. Without scores, a rule is `met` only if no leaf has a minimum score; otherwise `needs_scores` with the minimums listed. `not_met` lists the missing studies or the scores short. Recommended (not required) criteria and other selection criteria (folio, interview) are listed beside the result and never evaluated. For `search_courses`, `vceStudies` keeps courses whose rules can be met by the studies ignoring scores, and says so.

**4. Entry year chooses the prerequisite block.** `entryYear` defaults to the next admissions year. If only an earlier year's prerequisites are stored, the result uses them and warns that the stated year's prerequisites are not yet stored.

**5. Entry figures are shown with their kind and year, always.** Fixed display text per kind, for example `lowest_selection_rank`: "Lowest selection rank that received an offer in {year} (after adjustments)"; `guaranteed_atar`: "Guaranteed entry ATAR for {year} entry". `figureAtMost` filters on the latest `lowest_selection_rank` only, and the result says which figure kind and year it used. Search order is by name unless the user asks for figure order, which is then stated.

**6. Aggregate and scaling.** `estimate_vce_aggregate` calls the pure function from `add-vce-admissions-data` and returns the aggregate, each study's scaled score (marked if interpolated), its role (primary, increment, not counted) and the reason. Fixed text says an aggregate is not an ATAR and that the ATAR depends on the whole state cohort. Both scaling tools declare `vce-scaling`, so production returns `data_unavailable` until permission clears; their descriptions say the data may not be available yet.

**7. Not in the store: links, not facts.** `get_course` and `search_courses` with no match return `found: false`, reason `not_in_dataset`, with `details` holding the university's course search URL (when the university is known), and the VTAC CourseSearch and Course Seeker home links. Links are fine to give (deep linking is allowed); no fact is read from those sites by us. Host instructions say: you may look the course up with your own web search, but quote the page you read, say it is not from Ask Righto's checked data, and do not mix it into Ask Righto's tables. Alternative: fetch the university page live ourselves. Rejected: 13 of 20 test pages were empty, blocked or partial, and a live fetch would bypass the curation that makes facts trustworthy.

**8. Output through Inkview with source attached.** `search_courses`: `inkview.table` (course, university, campus, latest figure with kind and year, prerequisites summary, link). `get_course`: `inkview.entityCard` plus markdown. `compare_courses`: `inkview.comparison` across the same fields. `check_course_prerequisites`: `inkview.table` (course, result, what is missing). Dates: a table (or the SDK's timeline component if available at the pinned version). Each component gets `source: { name, url, retrievedAt }` from the envelope; per-row links carry each fact's own source. Text-only hosts get markdown with the notice and source footer, as energy does.

**9. Notice and wording in one module.** `src/courses/notice.ts` holds the standard notice ("Past entry figures are not cut-offs or predictions. Prerequisites are as published for the year shown. Check the official course page before deciding. General information, not advice."), the per-kind figure labels and the banned words list ("chance", "you will get in", "best course", "recommended"). A test fails if any course result lacks the notice or uses a banned word.

**10. Minors and privacy.** No tool asks for name, school, age or contact details. Studies and scores are inputs to one call and never stored; the access log already excludes arguments. Host guidance asks the model not to request personal details.

**11. Server instructions (course section).**
- Use `search_courses` before naming courses; quote figures with their kind and year exactly as returned.
- Never say a student "will get in" or give odds; say what last year's figure was.
- Ask which VCE studies the student takes before `check_course_prerequisites`; ask for expected study scores only if the student wants a scored check or an aggregate.
- An aggregate is not an ATAR; never convert one.
- If a course is not found, say so, give the links returned, and if you search the web yourself, say the fact is not from Ask Righto.
- If data is unavailable (for example scaling), say so; do not quote scaling from memory.

## How results carry source and as-of date

Every result is built with `found({ data, source, asOf })`. Course results set `source` to the course's official page and `asOf` to the oldest `checked_on` among the facts shown; each entry figure and prerequisite block also carries its own `sourceUrl`, `intakeYear` or `appliesToYear`, and `checkedOn`. Comparison and search results set the result-level `source` to the `vic-courses` dataset and list each course's official URL per row. Aggregate and scaling results use the VTAC scaling report as `source`, its publication date as `asOf`, and VTAC's required attribution. Dates and schemes carry each row's own link and checked date. Staleness warnings come from the registry.

## Risks / Trade-offs

- [Students read a past lowest selection rank as a guaranteed cut-off] → Kind and year on every figure, fixed labels, the notice, and host guidance; a test checks the label text.
- [Structured prerequisites drift from the official page] → March and August re-checks, the entry-year warning, and "check the official page" on every result.
- [Scaling permission never arrives, so the aggregate tools stay unavailable] → They are clearly marked unavailable; the rest of the vertical stands on course facts, dates and schemes.
- [Host models add advice anyway ("you should pick Chemistry")] → Instructions, neutral wording, and listing test prompts such as "which subjects should I pick?" and "will I get into Monash Medicine?".
- [Audience includes minors] → No personal details, nothing stored, and the Children's Online Privacy Code check before 10 Dec 2026 from the listing changes.

## Open Questions

- Whether to port the pilot's subject combination generator later, and under what wording, given the advice concern.
- Whether Gemini draws Inkview components (presentation only; markdown is always present).
