> **Superseded in part (27 Nov 2026) by `switch-to-index-only`:** courses and home loans no longer store source data, so the stored-data, permission and legal-view parts of this change are not built. Read the new change first.

# Proposal

## Why

A VCE student or parent choosing subjects or VTAC preferences needs the same few facts for every course they are weighing: what the entry figure was last year and what kind of figure it is, which VCE subjects and study scores are prerequisites, what else is assessed (folio, interview, test), where it is taught, and where to check. Those facts are spread across nine Victorian universities' sites and labelled differently on each: lowest ATAR, lowest selection rank, guaranteed ATAR, entry threshold, for different intake years.

The obvious shortcuts are closed. No admissions centre or Course Seeker offers an open licence, so the pilot's scraped VTAC CSV cannot ship. Live lookup of university pages fully answered only 7 of 20 test courses (pages that render with JavaScript, block readers, or label figures inconsistently). The pilot's hand-compiled `vic-university-atar-catalog.csv` (109 courses, facts in our own words with official links) is the pattern that works. This change builds a course index that covers every course from open data and our own link list, and attaches curated, checked facts to the courses that need them most. Courses without curated facts are still found, and the host's browser agent can read the official page on the user's behalf (Iven, 16 Nov 2026: the preferred way to lower copyright risk). A browser test on 16 Nov read full facts from 7 of 18 VIC pages; bot checks stopped Melbourne, ACU and others, which is where curated facts matter most.

## What Changes

- Build **one course index** for every Victorian undergraduate course at a university: one row per course, whether or not we hold detailed facts for it. Each row has provider, course name, level, campuses, duration, CRICOS code where one exists, field of study, and links: the university's course page and the Course Seeker page. Links are facts we may give; no page content is copied.
- Seed the index from CRICOS (data.gov.au, CC BY 2.5 AU). CRICOS covers courses offered to international students, so domestic-only courses are missing; **fill those gaps by hand** from the universities' own course lists, each gap row recording where it was found. A monthly gap report (provider course lists against the index) shows what is still missing.
- Let each index row carry an **optional curated fact set** in our own words: a short summary, entry figures, prerequisites, and other selection criteria. Each row states its **depth**: `index_only` or `curated`. The course tools answer from the curated facts when present, and otherwise hand the host the links plus a reading checklist (see `add-vic-course-tools`).
- Store each curated entry figure with its **kind** (`lowest_atar`, `lowest_selection_rank`, `guaranteed_atar`, `entry_threshold`, `median_atar`), its **intake year**, the page it came from and the date it was checked. A figure without a kind and year is rejected.
- Store curated prerequisites as structured rules (VCE study, minimum study score, alternatives and "any one of" groups, EAL variants) alongside our own paraphrase of the official wording, so code can check them instead of reading prose.
- Keep the gap rows, links and curated facts as reviewed source files in the repo (`data/courses/vic/<provider>.yaml`), one per university. Together with the CRICOS download they are the source of truth; the database is loaded from them and can be rebuilt at any time.
- Add a validator and a page checker. The validator enforces the schema, kinds, years and links. The page checker, run from a machine that can reach the sites, confirms each link still answers, and flags any curated text that shares a long run of words with the official page, so text is not copied by accident.
- Load CRICOS and the curated files into one set of PostgreSQL tables in the `askrighto` schema through a new migration, register the `vic-courses` dataset (index and curated facts together, each row saying which source it came from), and add a readiness check.
- Curate first the courses people ask about most: the pilot's 109 catalogued courses, rebuilt from their official pages, and courses at universities whose pages block browser agents (see design). Every other course starts `index_only`.

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

- `vic-course-data`: the index of Victorian undergraduate courses (CRICOS base plus hand-filled gaps, with official links) and the optional curated facts attached to it: where each row and fact comes from, how figures are labelled, how prerequisites are structured, how the set is checked and kept fresh, and how it stays traceable to the official page.

### Modified Capabilities

None.

## Impact

- New data: `data/courses/vic/*.yaml` (curated facts), `data/vce-studies.yaml` (the VCE study list with VCAA names and codes, used to normalise prerequisites).
- New code: `src/courses/` (model, loader, store, CRICOS client, readiness), a migration creating `providers`, `courses`, `course_campuses`, `course_entry_figures` and `course_prerequisites`, and CLI commands `courses:validate`, `courses:check-pages`, `courses:gap-report` and `courses:load`.
- Depends on `add-mcp-server-core` (registry) and `add-course-data-permissions` (rights register, which gates production serving). Uses the existing database, pool and migration runner from the energy vertical.
- New outbound traffic: a monthly CRICOS download from data.gov.au, and page checks run by hand from a developer machine (the cloud workspace may not reach university sites).
- Ongoing effort: keeping links working and filling index gaps (small), and re-checking curated facts each admissions year (roughly a day per university, judgement, not measured). Curation depth can grow or shrink without changing the tools.
- The legal view on re-keying facts (roadmap Phase 0) remains a gate before public listing.
