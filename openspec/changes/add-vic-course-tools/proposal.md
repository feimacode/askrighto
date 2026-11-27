> **Superseded in part (27 Nov 2026) by `switch-to-index-only`:** courses and home loans no longer store source data, so the stored-data, permission and legal-view parts of this change are not built. Read the new change first.

# Proposal

## Why

With course facts and admissions data in place, a VCE student or parent still has no way to use them from a chat. The questions are joined-up ones that one web search does not answer well: "which engineering courses in Melbourne can I do with the subjects I've picked?", "compare these three nursing degrees", "does dropping Methods rule anything out?", "if I get around 35 in Chemistry and 30 in English, what's my aggregate?", "when do preferences close?". The previous pilot answered them with a deterministic engine plus an in-app LLM; here the host model narrates, so the engine's pure functions become MCP tools nearly one to one, and every figure comes from a tool result with its source and date.

## What Changes

- Add `search_domestic_courses`: find VIC undergraduate courses by name or keyword, field, university and campus, optionally only those whose prerequisites the student's VCE studies can meet, or whose latest published lowest selection rank is at or below a given figure.
- Add `get_domestic_course`: one course in full: our summary, each entry figure with its kind, intake year and source, prerequisites for the entry year asked, other selection criteria, campuses, codes and the official page.
- Add `compare_domestic_courses`: two to five courses side by side on the same fields.
- Add `check_domestic_course_prerequisites`: for up to ten courses and the student's studies (and, optionally, expected study scores), say per course whether the published prerequisites are met, not met (and what is missing), or cannot be told without scores.
- Add `get_subject_scaling` and `estimate_vce_aggregate`: scaled scores and an aggregate from the student's expected study scores, with each study's role. Both stay `data_unavailable` in production until VTAC's permission clears the scaling data.
- Add `get_vce_key_dates` and `list_early_entry_schemes`: admissions dates and university early offer schemes, with links and no eligibility verdict.
- Answer at two depths from the one course index (`add-vic-course-data`). For a **curated** course, return its checked facts. For an **index-only** course, return the course, its official university page and Course Seeker page, and a reading checklist (entry figure with its kind and year, prerequisites with study scores, other criteria), so the host's browser agent can read the page on the user's behalf (Iven, 16 Nov 2026). Every result says which depth it is. A course not in the index at all gets the university's course search link. This covers the roadmap's `add-course-live-lookup` item.
- Render search, comparison and prerequisite results with Inkview components (table, comparison, entity card) with the markdown fallback, as energy does. This covers the roadmap's `add-course-widgets` item.
- Add fixed wording and a standard notice for every course result: entry figures are past results, not cut-offs or predictions; prerequisites are as published for the stated year; check the official page; general information, not advice.
- Add host guidance for course questions to the server instructions.

Data sources: the `vic-courses` dataset (CRICOS index plus curated facts) from `add-vic-course-data`, and the `vce-key-dates`, `vtac-preference-rules`, `vic-early-entry`, `vce-scaling` and `vce-study-groupings` datasets from `add-vce-admissions-data`. Reuse bases and refresh cadence are inherited from those changes and the rights register; this change adds no new source.

Hosts affected: at first only named testers on the internal route (Claude and ChatGPT developer mode); after promotion, Claude, ChatGPT and Gemini all get the eight tools. Inkview components draw in Claude and ChatGPT; Gemini falls back to text until tested. ChatGPT allows users aged 13 to 17, the core audience here, so the tools ask for no personal details and keep study scores to the single call.

Out of scope:

- Predicting an ATAR, a study score or a chance of an offer, and any "you will get in" wording.
- Recommending a course or a subject, or ordering results by anything other than a stated, neutral key (name, or published figure when the user asks).
- Building or ordering a VTAC preference list, offer-round and change-of-preference helpers (a later change, `add-vtac-preference-tools`).
- SEAS, scholarships, fees and graduate outcomes.
- NSW and QLD courses (Phase 6), TAFE, postgraduate and international entry.
- Storing anything the student says, including subjects and scores.

## Capabilities

### New Capabilities

- `course-lookup`: finding Victorian courses, showing one course's published facts and comparing courses, including the not-in-store fallback.
- `vce-planning`: checking a student's VCE studies against course prerequisites, scaling and aggregate estimates, key admissions dates and early entry schemes.

### Modified Capabilities

None.

## Impact

- New code: `src/tools/` (eight tool files and a shared `course-common.ts`), `src/courses/render.ts` (Inkview and markdown), `src/courses/notice.ts`, `src/courses/prerequisites.ts` (rule evaluator), study-name matching against `data/vce-studies.yaml`.
- Ports from `vce-subject-planner/apps/api/src/recommendation/`: the tool schemas in `tools.ts` (converted to MCP tools with annotations; the in-app LLM call is dropped), and the search, early entry and aggregate logic. The pilot's candidate generation and ranking engine is not ported in this change (see design).
- Server instructions gain a course section.
- Depends on `add-mcp-server-core`, `add-course-data-permissions`, `add-vic-course-data` and `add-vce-admissions-data`. Reuses the Inkview SDK already added by `add-energy-plan-tools`.
- Ships behind the `courses-domestic` vertical flag (earlier called `courses`) and is served only on the internal route (`add-canary-release`) until its promotion gates pass. The legal view on re-keyed course facts and Claude's and OpenAI's rules for apps used by minors are among those gates.
