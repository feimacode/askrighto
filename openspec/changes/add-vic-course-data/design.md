# Design

## Context

- Rights (see `add-course-data-permissions`): university course pages are reusable only as individual facts in our own words with a link; no TAC or Course Seeker material may be copied without written permission; CRICOS is CC BY 2.5 AU.
- Live lookup test (12 Nov 2026, 20 popular VIC, NSW and QLD courses): 7 pages gave ATAR, subjects and CRICOS code; 5 were partial; 5 loaded empty (JavaScript rendering: Monash, Sydney, QUT Business, Newcastle); 3 blocked the reader (Melbourne, Macquarie, Griffith). University PDF course guides (Monash, Sydney) held the data cleanly. Figures were labelled differently across universities and years.
- Pilot: `vce-subject-planner/data/vic-university-atar-catalog.csv` has 109 courses with lowest ATAR, lowest selection rank, intake year, VTAC code, official page, prerequisites as prose, other criteria and notes. Its `prerequisites.ts` only extracted *mentioned* subjects from prose and treated any one as enough, which over- and under-matched; the module documented this as a known gap.
- Architecture (docs/architecture.md, section 6.2): a vertical is a data module that registers a `DataSet`, optionally adds a readiness check, and owns its tables through a migration; tools come separately.

See proposal.md for motivation and the spec for requirements.

## Goals / Non-Goals

**Goals:**

- Every stored figure says what kind of figure it is, for which intake year, from which page, checked when.
- Prerequisites precise enough for code to say met, not met, or cannot tell.
- A store anyone can rebuild from the repo plus a public download.
- Curation that is fast to repeat each year and hard to get subtly wrong.

**Non-Goals:**

- Complete coverage of every Victorian course at first release. Coverage grows by field.
- Predicting next year's figures. Only published past figures are stored.
- Reading pages automatically to extract facts.

## Decisions

**1. Curated YAML in the repo is the source of truth; PostgreSQL is a loaded copy.** One file per university, reviewed through pull requests, so every change to a fact has a diff, an author and a reason. `courses:load` validates and loads them into the database in one transaction. Alternative: edit facts straight in the database through an admin tool. Rejected: no review trail, and the store would stop being rebuildable from source (AGENTS.md rule 3). Alternative: keep everything in memory from the bundled files. Considered, since the set is small (hundreds of courses), but rejected for consistency with energy: one readiness model, one `list_data_sources` path, and room for joins with CRICOS and later states.

**2. File shape.**

```yaml
provider: { id: monash, name: Monash University, coursesUrl: https://www.monash.edu/study/courses }
courses:
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
courses              (id pk, provider_id fk, name, level, fields text[], duration_years, cricos_code,
                      vtac_code, summary, official_url, checked_on, checked_by, source_file, content_hash)
course_campuses      (course_id fk, campus, mode)
course_entry_figures (course_id fk, kind, value numeric(5,2), intake_year, campus, source_url, checked_on)
course_prerequisites (course_id fk, applies_to_year, text, rules jsonb, source_url, checked_on)
cricos_courses       (cricos_code pk, provider_code, course_name, level, duration_weeks, locations text[], loaded_at)
course_loads         (id pk, loaded_at, git_sha, course_count, figure_count, report jsonb)
```

Indexes: `courses (provider_id)`, GIN on `courses.fields`, a trigram index on `courses.name` for name search, `course_entry_figures (course_id, intake_year)`. `courses:load` replaces the course tables in one transaction; `course_loads` records which commit was loaded, which becomes the as-of for the dataset.

**7. Validation rules (`courses:validate`, runs in CI).** Every figure has kind, value between 0 and 99.95, intake year within the last three years, source URL on the provider's own domain or a listed government domain, and a checked date. Every course has an official URL on the provider's domain and a summary of at most 60 words. Every prerequisite leaf names a known VCE study. Duplicate ids fail. A source URL on `vtac.edu.au` or `courseseeker.edu.au` fails while their rights status is not cleared.

**8. Page checker (`courses:check-pages`, run by hand).** Fetches each cited URL at most once a second, records status and final URL, and compares our `summary` and prerequisite `text` with the page text: any run of 12 or more identical words is flagged for rewording. It never writes facts. Pages that need JavaScript are reported as "check by hand". Alternative: headless browser extraction. Rejected: that is scraping by another name and the rights basis is facts re-keyed by a person.

**9. CRICOS as a lead and cross-check.** Monthly download of the CRICOS course and location files from data.gov.au into `cricos_courses`. The loader warns when a curated `cricosCode` is missing from CRICOS or the names differ, and a report lists CRICOS bachelor courses at VIC providers that are not yet curated, which drives coverage work. CRICOS facts shown to users carry the CC BY attribution.

**10. Seed and coverage.** Rebuild the pilot's 109 courses from official pages (not from the pilot CSV values, which may be a year old) as the seed. Then widen by field, guided by the CRICOS gap report. The coverage target for launch is an open question for Iven.

**11. Staleness.** `maxAgeHours` for `vic-courses` is 400 days, since facts change once a year; an entry figure older than the latest intake year the provider has published is flagged by the page checker. Each tool result also states each figure's intake year, so staleness is visible per fact, not only per dataset.

## How results carry source and as-of date

Every fact row keeps its own `source_url` and `checked_on`. The dataset-level `source` is the provider's course page (`officialUrl`) with `licence: "Facts in our own words; see the official page"`, and `asOf` is the `checked_on` of the facts shown. Tools in `add-vic-course-tools` put each figure's own source URL, intake year and checked date beside it. CRICOS-derived facts carry `licence: "CC BY 2.5 AU"` and the CRICOS attribution.

## Risks / Trade-offs

- [Curation is manual and slow] → Seed from the pilot's 109, widen by field with the CRICOS gap report, and keep re-checks to an annual pass driven by the page checker's report.
- [A transcription error looks official] → Pull-request review of every YAML change, validator bounds, a second person or a page-checker diff before each release, and the five-day correction route from `add-course-data-permissions`.
- [Re-keyed facts may still be challenged] → Facts only, our own wording, a link on every fact, a verbatim-run check, and the legal view before public listing.
- [The repo is public, so the curated YAML is a downloadable compilation of course facts, unlike energy, where the copy stays internal behind the tools] → The facts are re-keyed and linked, which is the basis we rely on anyway, but a bulk file is a different exposure from per-question answers. Raised as an open question; moving the curated files to a private repo or package is cheap if the legal view prefers it.
- [Universities change URLs every year] → The page checker reports redirects and 404s; a broken source URL marks the fact for re-check rather than hiding it.
- [CRICOS codes cover international offerings only] → CRICOS is a cross-check, not a requirement; domestic-only courses are curated without a code.

## Open Questions

- Coverage target for launch: all VIC university bachelor courses, or the most-applied-for few hundred.
- Whether to include ACU, Federation and the VIC campuses of interstate universities (for example CQU, Charles Sturt) at launch.
- Whether the curated course files may live in the public repo, or should sit in a private repo or package that the build pulls in. Put to the legal view.
- Who does the annual re-check, and whether a second reviewer is required for every figure change.
