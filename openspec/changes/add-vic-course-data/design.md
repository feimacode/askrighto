# Design

## Context

- Rights (see `add-course-data-permissions`): university course pages are reusable only as individual facts in our own words with a link; no TAC or Course Seeker material may be copied without written permission; CRICOS is CC BY 2.5 AU.
- Live lookup test (12 Nov 2026, 20 popular VIC, NSW and QLD courses): 7 pages gave ATAR, subjects and CRICOS code; 5 were partial; 5 loaded empty (JavaScript rendering: Monash, Sydney, QUT Business, Newcastle); 3 blocked the reader (Melbourne, Macquarie, Griffith). University PDF course guides (Monash, Sydney) held the data cleanly. Figures were labelled differently across universities and years.
- Pilot: `vce-subject-planner/data/vic-university-atar-catalog.csv` has 109 courses with lowest ATAR, lowest selection rank, intake year, VTAC code, official page, prerequisites as prose, other criteria and notes. Its `prerequisites.ts` only extracted *mentioned* subjects from prose and treated any one as enough, which over- and under-matched; the module documented this as a known gap.
- Browser test (16 Nov 2026, headless Chromium, 18 VIC course pages): full facts (figure with kind and year, VCE prerequisites with study scores) on 7 (Monash, Deakin, RMIT, Swinburne); partial on 3 (Melbourne, Victoria University); 8 failed, mostly Cloudflare bot checks (Melbourne, ACU) and pages that did not render (La Trobe). We do not get past bot checks.
- Direction (Iven, 16 Nov 2026): let the user's own AI read course pages on their behalf where it can, to lower copyright risk; index courses from CRICOS and fill gaps; keep curated own-words facts together with that index.
- Architecture (docs/architecture.md, section 6.2): a vertical is a data module that registers a `DataSet`, optionally adds a readiness check, and owns its tables through a migration; tools come separately.

See proposal.md for motivation and the spec for requirements.

## Goals / Non-Goals

**Goals:**

- Every Victorian university undergraduate course can be found, with working links, even when we hold no detailed facts for it.
- Every stored figure says what kind of figure it is, for which intake year, from which page, checked when.
- Prerequisites precise enough for code to say met, not met, or cannot tell.
- A store anyone can rebuild from the repo plus a public download.
- Curation that is fast to repeat each year and hard to get subtly wrong.

**Non-Goals:**

- Curated facts for every course at first release. Curation depth grows by demand; the index is complete from the start.
- Predicting next year's figures. Only published past figures are stored.
- Reading pages automatically to extract facts.

## Decisions

**0. One index, two depths.** Every course is one row in `courses`, with `origin` (`cricos` or `gap_fill`) and `depth` (`index_only` or `curated`). Curated facts (summary, entry figures, prerequisites, other criteria) hang off that row in their own tables. Tools query one table and branch on `depth`: curated courses get facts, index-only courses get links and a reading checklist for the host's browser agent. Alternative: a separate CRICOS index and a separate curated store, joined at query time. Rejected (Iven, 16 Nov 2026): two stores to keep in step, and every tool would have to merge them. With one table, promoting a course from index-only to curated is adding facts to its YAML entry, and dropping curation (for example if a legal view says so) is removing them, with no tool change.

**1. CRICOS plus YAML in the repo are the source of truth; PostgreSQL is a loaded copy.** CRICOS gives the base rows. One YAML file per university adds gap rows, links and curated facts, reviewed through pull requests, so every change has a diff, an author and a reason. `courses:load` merges them and loads the database in one transaction. One file per university, reviewed through pull requests, so every change to a fact has a diff, an author and a reason. `courses:load` validates and loads them into the database in one transaction. Alternative: edit facts straight in the database through an admin tool. Rejected: no review trail, and the store would stop being rebuildable from source (AGENTS.md rule 3). Alternative: keep everything in memory from the bundled files. Considered, since the set is small (hundreds of courses), but rejected for consistency with energy: one readiness model, one `list_data_sources` path, and room for joins with CRICOS and later states.

**2. File shape.**

```yaml
provider: { id: monash, name: Monash University, coursesUrl: https://www.monash.edu/study/courses }
courses:
  # index-only: a CRICOS course we only link to; name, campus and duration come from CRICOS
  - id: monash-bachelor-of-arts
    cricosCode: 012346B
    officialUrl: https://…
    courseSeekerUrl: https://…
  # gap fill: a domestic-only course CRICOS does not list
  - id: monash-bachelor-of-nursing-practice
    origin: gap_fill
    name: Bachelor of Nursing Practice
    level: bachelor
    campuses: [peninsula]
    foundAt: https://www.monash.edu/study/courses   # where we found it listed
    officialUrl: https://…
  # curated: index fields plus facts in our own words
  - id: monash-bachelor-of-science            # stable, ours
    name: Bachelor of Science
    level: bachelor
    fields: [science]
    campuses: [clayton]
    durationYears: 3
    cricosCode: 012345A                        # optional, cross-checked with CRICOS
    vtacCode: "2800X"                          # optional, only as the university publishes it
    summary: >-                                # our words, at most 60 words
      A three-year science degree with majors across the physical, life and mathematical sciences.
    officialUrl: https://…
    entryFigures:
      - { kind: lowest_selection_rank, value: 80.05, intakeYear: 2026, campus: clayton,
          sourceUrl: https://…/student-profile, checkedOn: 2026-11-20 }
    prerequisites:
      text: English (any) study score at least 25 (EAL at least 30), and one of Maths Methods or Specialist Maths at least 25.
      rules:
        - allOf:
            - { anyOf: [{ study: english-group, minScore: 25, ealMinScore: 30 }] }
            - { anyOf: [{ study: mathematical-methods, minScore: 25 }, { study: specialist-mathematics, minScore: 25 }] }
      sourceUrl: https://…
      appliesToYear: 2028
      checkedOn: 2026-11-20
    otherCriteria: [{ kind: none }]           # folio, interview, audition, test, personal_statement, none
    checkedBy: iven
```

**3. Entry figure kinds are a closed enum.** `lowest_atar` (lowest ATAR before adjustments that received an offer), `lowest_selection_rank` (after adjustments), `guaranteed_atar`, `entry_threshold` (a published minimum, not an outcome), `median_atar`. A figure is per campus where the university publishes it per campus. Display wording is fixed per kind in `add-vic-course-tools`, so "lowest selection rank to get an offer in 2026" is never shown as "the ATAR you need". Alternative: store one `atar` number. Rejected: the 12 Nov test showed it would mix guarantees with outcomes and years, which is exactly the error users distrust.

**4. Prerequisite rules are a small tree.** `allOf` and `anyOf` nodes over leaves `{ study, minScore?, ealMinScore?, unitsOnly? }`, where `study` is an id from `data/vce-studies.yaml` (VCAA study names and codes) or a group id (`english-group`, `any-mathematics`). The text is our paraphrase of the official wording for display; the rules are what code evaluates. When a requirement cannot be expressed (for example "a strong background in science is recommended"), it goes in `otherCriteria` as `recommended` and is never evaluated. Alternative: keep prose and parse it at runtime, as the pilot did. Rejected: the pilot documented that it over- and under-matched.

**5. Applies-to year for prerequisites.** Prerequisites are published years ahead (VTAC publishes them for students in Year 10), so each block records the intake year it applies to. A student in Year 10 in 2026 looks at 2029 entry; the tools pick the block for the year asked, and say when only an earlier year is stored.

**6. Tables.**

```
providers            (id pk, name, courses_url, cricos_provider_code)
courses              (id pk, provider_id fk, origin, depth, name, level, fields text[], duration_years,
                      cricos_code, vtac_code, official_url, course_seeker_url, found_at,
                      summary, checked_on, checked_by, link_checked_on, content_hash)
course_campuses      (course_id fk, campus, mode)
course_entry_figures (course_id fk, kind, value numeric(5,2), intake_year, campus, source_url, checked_on)
course_prerequisites (course_id fk, applies_to_year, text, rules jsonb, source_url, checked_on)
cricos_raw           (cricos_code pk, provider_code, course_name, level, duration_weeks, locations text[], loaded_at)
course_loads         (id pk, loaded_at, git_sha, course_count, figure_count, report jsonb)
```

Indexes: `courses (provider_id)`, GIN on `courses.fields`, a trigram index on `courses.name` for name search, `course_entry_figures (course_id, intake_year)`. `cricos_raw` holds the last CRICOS download as received, so a merge can be re-run without downloading again. `courses:load` merges CRICOS rows (VIC providers, bachelor and associate degree levels) with the YAML entries and replaces the course tables in one transaction; `course_loads` records which commit was loaded, which becomes the as-of for the dataset.

**7. Validation rules (`courses:validate`, runs in CI).** Every figure has kind, value between 0 and 99.95, intake year within the last three years, source URL on the provider's own domain or a listed government domain, and a checked date. Every curated course has an official URL on the provider's domain and a summary of at most 60 words; every index row's links are on the provider's domain or `courseseeker.edu.au` (linking is allowed; no content is taken from it). Every prerequisite leaf names a known VCE study. Duplicate ids fail. A fact's source URL on `vtac.edu.au` or `courseseeker.edu.au` fails while their rights status is not cleared.

**8. Page checker (`courses:check-pages`, run by hand).** Fetches each cited URL at most once a second, records status and final URL, and compares our `summary` and prerequisite `text` with the page text: any run of 12 or more identical words is flagged for rewording. It never writes facts. Pages that need JavaScript are reported as "check by hand". Alternative: headless browser extraction. Rejected: that is scraping by another name and the rights basis is facts re-keyed by a person.

**9. CRICOS is the base; gaps are filled by hand.** Monthly download of the CRICOS course and location files from data.gov.au. Every VIC-provider undergraduate course in CRICOS becomes an index row; name, level, campuses and duration come from CRICOS unless a curated entry overrides them with a source. CRICOS has no course page URLs, so `officialUrl` and `courseSeekerUrl` are our own link list, kept in the YAML and checked by the page checker. `courses:gap-report` compares each university's own published course list against the index and lists courses missing from CRICOS (domestic-only courses); a person adds them as `gap_fill` rows with `foundAt`. An index row without an `officialUrl` is loaded but reported, and tools give the provider's course search link for it. CRICOS-derived fields shown to users carry the CC BY attribution. A CRICOS course that disappears is removed from the index on the next load unless a curated entry keeps it with a source.

**10. What gets curated first.** The index covers every course from day one. Curation goes where browsing on the user's behalf is weakest or demand is highest: the pilot's 109 courses (rebuilt from official pages, not from the pilot CSV values, which may be a year old), then courses at universities whose pages block or fail for browser agents (Melbourne, ACU and La Trobe in the 16 Nov test), then the most-asked courses. How deep to curate for launch is an open question for Iven.

**11. Staleness.** `maxAgeHours` for `vic-courses` is 400 days, since facts change once a year; an entry figure older than the latest intake year the provider has published is flagged by the page checker. Each tool result also states each figure's intake year, so staleness is visible per fact, not only per dataset.

## How results carry source and as-of date

Every fact row keeps its own `source_url` and `checked_on`. The dataset-level `source` is the provider's course page (`officialUrl`) with `licence: "Facts in our own words; see the official page"`, and `asOf` is the `checked_on` of the facts shown. Tools in `add-vic-course-tools` put each figure's own source URL, intake year and checked date beside it. CRICOS-derived facts carry `licence: "CC BY 2.5 AU"` and the CRICOS attribution. An index-only course result carries `source` = the course's official page (or CRICOS for the index fields), `asOf` = the CRICOS load date or the link check date, and a `depth: index_only` marker so tools never present it as checked facts.

## Risks / Trade-offs

- [Curation is manual and slow] → The index carries coverage, so curation can stay small: the pilot's 109 plus courses on sites browser agents cannot read; re-checks are an annual pass driven by the page checker's report.
- [Index-only answers depend on the host having a browser agent] → Text-only hosts still get the course, its links and the checklist, and the result says no facts are held; curated depth is the remedy where it matters.
- [Domestic-only courses are missing from CRICOS] → The gap report against each university's own course list, and hand-filled `gap_fill` rows.
- [A transcription error looks official] → Pull-request review of every YAML change, validator bounds, a second person or a page-checker diff before each release, and the five-day correction route from `add-course-data-permissions`.
- [Re-keyed facts may still be challenged] → Facts only, our own wording, a link on every fact, a verbatim-run check, and the legal view before public listing.
- [The repo is public, so the curated YAML is a downloadable compilation of course facts, unlike energy, where the copy stays internal behind the tools] → The facts are re-keyed and linked, which is the basis we rely on anyway, but a bulk file is a different exposure from per-question answers. Raised as an open question; moving the curated files to a private repo or package is cheap if the legal view prefers it.
- [Universities change URLs every year] → The page checker reports redirects and 404s; a broken source URL marks the fact for re-check rather than hiding it.

## Open Questions

- Curation depth for launch: the pilot's 109 plus bot-blocked universities, or more.
- Whether to include ACU, Federation and the VIC campuses of interstate universities (for example CQU, Charles Sturt) at launch.
- Whether the curated course files may live in the public repo, or should sit in a private repo or package that the build pulls in. Put to the legal view.
- Who does the annual re-check, and whether a second reviewer is required for every figure change.
