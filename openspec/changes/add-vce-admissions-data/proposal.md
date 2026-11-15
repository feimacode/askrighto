# Proposal

## Why

Course facts answer "what does this course need?". The questions VCE families ask next need the rules around them: "if I swap Chemistry for Legal Studies, how does that change my aggregate?", "when do VTAC preferences close?", "does this uni have an early offer scheme for my course?". The previous pilot answered these from VTAC's scaling report, VTAC study area groupings, VTAC and VCAA key dates, and early entry pages, and its engine (`atar-aggregate.ts`, `early-entry.ts`, key dates) is worth porting.

The rights picture differs by source, which is why this is its own change. Dates, deadlines and rules can be stated as individual facts in our own words with a link, like course facts. The scaling report's scaled-score table and the study area groupings list are VTAC compilations that no university republishes; using them needs VTAC's written permission, which `add-course-data-permissions` asks for. This change builds all of it, and lets each part go live when its rights entry clears.

## What Changes

- Add VCE key dates for the current and next admissions year in our own words: VCAA exam period and results release, VTAC application open and close, timely and late deadlines, SEAS and scholarship deadlines, change-of-preference windows and offer rounds, each with its official link and checked date.
- Add VTAC preference rules in our own words: maximum preferences, how order affects offers, one offer per round, change-of-preference timing, with links to the VTAC pages.
- Add early entry and early offer schemes run by Victorian universities: scheme name, provider, which courses it can cover, published conditions in our own words, application dates, and the scheme page.
- Add the ATAR aggregate counting rule as code (English-group study first, next three best permissible scaled scores, then 10% of the fifth and sixth, study-area-grouping limits), documented with its source.
- Add VCE subject scaling (mean, spread and scaled score at fixed study scores per study per year) and study area groupings as datasets **gated on VTAC's written permission**: built and tested against a local development copy, never committed or served in production until the rights entry is cleared.
- Store these as curated YAML (dates, rules, schemes) loaded into the `askrighto` schema, register each as its own dataset so each carries its own rights status, and add readiness checks.

Data sources:

| Dataset | Source | Reuse basis | Refresh |
| --- | --- | --- | --- |
| `vce-key-dates` | VCAA key dates and exam timetable pages; VTAC dates page | Own-words facts with links (VCAA terms to confirm) | Each February and August, and on change notices |
| `vtac-preference-rules` | VTAC course preferences fact sheet and offers pages | Own-words facts with links; VTAC asked to confirm | Each August |
| `vic-early-entry` | Each university's early offer scheme page | Own-words facts with links | Each March and August |
| `vce-scaling` | VTAC scaling report (annual PDF) | Written permission from VTAC (pending) | Each December, when the report is published |
| `vce-study-groupings` | VTAC study area groupings fact sheet | Written permission from VTAC (pending) | Each year with the scaling report |

Hosts affected: none directly. This change adds no tool; Claude, ChatGPT and Gemini see the data through `add-vic-course-tools` and `list_data_sources`.

Out of scope:

- Converting an aggregate into a predicted ATAR. VTAC's aggregate-to-ATAR table was excluded in the pilot and stays excluded; it would also invite "you will get X" readings.
- Predicting study scores, or any "chance of getting in".
- SEAS category explanations and eligibility (a separate later change, with care for sensitive circumstances).
- VCAA school subject availability (VCAA terms still to be checked; later change).
- Grade distributions, VCE VM and IB pathways, NSW and QLD rules (Phase 6).
- Any user data.

## Capabilities

### New Capabilities

- `vce-admissions-data`: VCE and VTAC admissions reference data (key dates, preference rules, early entry schemes, the aggregate counting rule, scaling and study area groupings): where each comes from, its rights gate, and how it is kept current.

### Modified Capabilities

None.

## Impact

- New data: `data/vce/key-dates.yaml`, `data/vce/preference-rules.yaml`, `data/vce/early-entry.yaml`. Scaling and groupings stay in git-ignored `data/local/` until permission.
- New code: `src/vce/` (models, loader, aggregate rule as a pure function), a migration for `vce_key_dates`, `vtac_preference_rules`, `early_entry_schemes`, `vce_scaling`, `vce_study_groupings`, and CLI commands `vce:validate` and `vce:load`. The scaling loader reads the published report figures entered by hand or from a permitted file, not a PDF scraper.
- Ports from `vce-subject-planner`: `atar-aggregate.ts` rules and tests, `early-entry.ts` shaping, key-dates handling. Ported, not imported.
- Depends on `add-mcp-server-core`, `add-course-data-permissions` and `add-vic-course-data` (VCE study list, provider ids).
