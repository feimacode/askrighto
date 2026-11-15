# Proposal

## Why

A VCE student or parent choosing subjects or VTAC preferences needs the same few facts for every course they are weighing: what the entry figure was last year and what kind of figure it is, which VCE subjects and study scores are prerequisites, what else is assessed (folio, interview, test), where it is taught, and where to check. Those facts are spread across nine Victorian universities' sites and labelled differently on each: lowest ATAR, lowest selection rank, guaranteed ATAR, entry threshold, for different intake years.

The obvious shortcuts are closed. No admissions centre or Course Seeker offers an open licence, so the pilot's scraped VTAC CSV cannot ship. Live lookup of university pages fully answered only 7 of 20 test courses (pages that render with JavaScript, block readers, or label figures inconsistently). The pilot's hand-compiled `vic-university-atar-catalog.csv` (109 courses, facts in our own words with official links) is the pattern that works. This change turns that pattern into a curated, checked, versioned store the course tools can read.

## What Changes

- Add a course fact model: provider, course, campus, mode, duration, CRICOS code where one exists, VTAC code where published by the university, field of study, a short summary in our own words, entry figures, prerequisites, other selection criteria and the official course page.
- Store each entry figure with its **kind** (`lowest_atar`, `lowest_selection_rank`, `guaranteed_atar`, `entry_threshold`, `median_atar`), its **intake year**, the page it came from and the date it was checked. A figure without a kind and year is rejected.
- Store prerequisites as structured rules (VCE study, minimum study score, alternatives and "any one of" groups, EAL variants) alongside the official wording paraphrased in our own words, so eligibility can be checked by code, not by reading prose.
- Keep the curated facts as reviewed source files in the repo (`data/courses/vic/<provider>.yaml`), one per university, each fact with its source URL and checked date. These files are the source of truth; the database is loaded from them and can be rebuilt at any time.
- Add a validator and a page checker: the validator enforces the schema, kinds, years and links; the page checker (run from a machine that can reach the sites) confirms each source URL still answers, and flags any summary that shares a long run of words with the official page, so text is not copied by accident.
- Load the curated files and the CRICOS dataset into PostgreSQL tables in the `askrighto` schema through a new migration, register the `vic-courses` and `cricos` datasets with the registry, and add a readiness check.
- Use CRICOS (data.gov.au, CC BY 2.5 AU) as the lead list for provider names, course codes and campuses, and to cross-check curated entries. CRICOS has no ATARs and misses domestic-only courses, so it is never the only source for a course.
- Rebuild the pilot's 109 catalogued courses from their official pages under the new model as the seed, then widen coverage by field.

Data sources: (1) each Victorian university's own course pages, admissions transparency (student profile) pages and published course guides, used as `own_words_facts`: individual facts re-keyed in our own words with a link, no text or tables copied; (2) CRICOS on data.gov.au, CC BY 2.5 AU, refreshed monthly. Refresh cadence: curated facts are re-checked every admissions year from August, when universities publish the next year's figures, with a mid-cycle check of prerequisites in March; CRICOS monthly. Both are recorded in the data rights register from `add-course-data-permissions`.

Hosts affected: none directly. This change adds no tool; Claude, ChatGPT and Gemini see the data through `add-vic-course-tools` and through new entries in `list_data_sources`.

Out of scope:

- Shipping or loading `vtac-courses.csv`, `uac-nsw-courses.csv` or `qtac-qld-courses.csv` from the pilot, or any data read from VTAC CourseSearch or Course Seeker, unless written permission arrives (then a follow-up change).
- Scraping any site. Curation is a person reading the official page, with assistance; the page checker only fetches source URLs we already cite, at a low rate, to confirm they still answer.
- Scaling, ATAR aggregates, study area groupings, key dates and early entry schemes (`add-vce-admissions-data`).
- NSW, QLD and other states (Phase 6), TAFE and private providers, postgraduate courses, and international student entry.
- Fees, scholarships, graduate outcomes (QILT) and student satisfaction. Each is a separate source with its own licence check.
- Any user data. The tables hold public course facts only.

## Capabilities

### New Capabilities

- `vic-course-data`: the curated set of Victorian undergraduate course facts: where each fact comes from, how figures are labelled, how prerequisites are structured, how the set is checked and kept fresh, and how it stays traceable to the official page.

### Modified Capabilities

None.

## Impact

- New data: `data/courses/vic/*.yaml` (curated facts), `data/vce-studies.yaml` (the VCE study list with VCAA names and codes, used to normalise prerequisites).
- New code: `src/courses/` (model, loader, store, CRICOS client, readiness), a migration creating `providers`, `courses`, `course_campuses`, `course_entry_figures`, `course_prerequisites` and `cricos_courses`, and CLI commands `courses:validate`, `courses:check-pages` and `courses:load`.
- Depends on `add-mcp-server-core` (registry) and `add-course-data-permissions` (rights register, which gates production serving). Uses the existing database, pool and migration runner from the energy vertical.
- New outbound traffic: a monthly CRICOS download from data.gov.au, and page checks run by hand from a developer machine (the cloud workspace may not reach university sites).
- Ongoing curation effort: roughly a day per university per admissions year for re-checks (judgement, not measured), which is the main running cost of this vertical.
- The legal view on re-keying facts (roadmap Phase 0) remains a gate before public listing.
