# Design

## Context

- Pilot (`vce-subject-planner`): `data/vce-scaling-data.json` (94 studies, 2025, from `vtac.edu.au/files/pdf/reports/scaling-report-25.pdf`: mean, standard deviation, scaled score at raw 20 to 50), `atar-study-area-groupings.json` (VTAC fact sheet), `vce-key-dates.json` (VCAA and VTAC pages), `vtac-preference-mechanics.json`, `early-entry-schemes.json` (six university scheme pages), and `atar-aggregate.ts`, which implements the counting rule and documents it against VTAC's ATAR and scaling guide.
- None of these was licence-checked for public commercial reuse (roadmap Phase 0 lists the VCAA check as open).
- `add-course-data-permissions` gives each dataset a rights entry and gates production serving; it also forbids committing data for a pending source to the public repo.

See proposal.md for motivation and the spec for requirements.

## Goals / Non-Goals

**Goals:**

- Dates, rules and schemes that tools can quote exactly, each with its own link and checked date.
- An aggregate calculation that is a pure, tested function, ready to go live the day VTAC permission arrives.
- Each source switched on independently by its rights entry.

**Non-Goals:**

- Predicted ATARs, offer chances or study score predictions.
- Parsing VTAC PDFs automatically.

## Decisions

**1. One dataset per source family.** `vce-key-dates`, `vtac-preference-rules`, `vic-early-entry`, `vce-scaling`, `vce-study-groupings` are registered separately, so a refusal for one (say scaling) never takes the others down, and `list_data_sources` shows each with its own status. Alternative: one `vce-reference` dataset. Rejected: a single rights status would hold everything back to the slowest permission.

**2. Curated YAML, same pattern as courses.** Facts in our own words, each with `sourceUrl` and `checkedOn`, validated in CI, loaded in one transaction, rebuildable from the repo. Example:

```yaml
admissionsYear: 2028
dates:
  - id: vtac-applications-open
    label: VTAC applications open
    date: 2027-08-02
    sourceUrl: https://www.vtac.edu.au/dates
    checkedOn: 2026-11-20
  - id: vce-exams
    label: VCE written exams
    start: 2027-10-26
    end: 2027-11-17
    sourceUrl: https://www.vcaa.vic.edu.au/administration/key-dates/vce-examination-timetable
    checkedOn: 2026-11-20
    provisional: true          # VCAA publishes future periods as provisional
```

**3. Aggregate rule as a pure function.** `computeAggregate(studies: { study, scaledScore }[], groupings) → Aggregate | NotComputed`, porting the pilot's rule: eligible with at least four studies including one English-group study; primary four is the best English-group score plus the next three best permissible; increments are 10% of up to two further scores; study area grouping limits applied (at most two in the primary four from one grouping, at most three counting overall). Returns each study's role (primary, increment, not counted) and why. `NotComputed` reasons: `needs_english`, `fewer_than_four_studies`, `unknown_study`, `scaling_unavailable`, `groupings_unavailable`. Golden tests are ported from the pilot and checked by hand against VTAC's published worked example.

**4. Scaling is entered from the report, not scraped.** When permission arrives, the year's table is entered into `data/vce/scaling-<year>.yaml` (or loaded from a file VTAC supplies), with the report URL and publication date. Until then a development copy built from the pilot JSON lives in git-ignored `data/local/`. Alternative: keep a PDF parser. Rejected: parsing a VTAC document we have no permission for is the extraction their terms ban; with permission, a supplied file is better than a parser.

**5. Scaled score lookup.** The report gives scaled scores at study scores 20, 25, 30, 35, 40, 45 and 50. A study score between those points is interpolated linearly and the result says it was interpolated and between which published points. Alternative: return only published points. Rejected: students think in their own expected scores; linear interpolation between published points is stated, not hidden, and invents no data point beyond the published range. Scores below 20 or above 50 return `outside_published_range`.

**6. Key dates by admissions year, provisional flag.** Dates carry the admissions year they belong to and a `provisional` flag where the publisher marks them so. Tools show the flag. A date in the past is still returned (people ask "when did…") with a note.

**7. Early entry schemes keep conditions as published, reworded.** Each scheme stores conditions as a list of short own-words items plus a link; no eligibility is ever evaluated, following the pilot's "no eligibility verdict" rule, since conditions often involve school recommendations or personal circumstances.

**8. Tables.**

```
vce_key_dates        (id, admissions_year, label, date_start, date_end, provisional, source_url, checked_on)
vtac_preference_rules(id, admissions_year, rule_key, text, value jsonb, source_url, checked_on)
early_entry_schemes  (id, provider_id fk, name, admissions_year, covers text, conditions text[],
                      opens_on, closes_on, source_url, checked_on)
vce_scaling          (study_id, study_year, mean, std_dev, scaled_at jsonb, source_url, published_on)
vce_study_groupings  (study_id, grouping, study_year, source_url, checked_on)
vce_loads            (id, dataset_id, loaded_at, git_sha, row_count, report jsonb)
```

## How results carry source and as-of date

Each row has its own `source_url` and `checked_on` (or `published_on` for scaling). Tools in `add-vic-course-tools` return the row's URL and date beside each date, rule or scheme, and set the result-level `source` to the dataset's publisher page. An aggregate result's `source` is the VTAC scaling report for that year, with `asOf` its publication date, plus the attribution VTAC's permission requires (recorded in the rights register). Interpolated scaled scores carry a warning saying so.

## Risks / Trade-offs

- [VTAC refuses scaling permission] → The aggregate tool stays `data_unavailable` in production; course facts, dates, rules and schemes still ship. The tool description says it needs data not yet available, so hosts do not keep calling it.
- [Dates change mid-year (for example VCAA moves an exam)] → Re-check in February and August, the corrections route, and the provisional flag where the publisher marks it.
- [Aggregate figures read as a predicted ATAR] → Never convert to ATAR; fixed wording that an aggregate is not an ATAR; covered in the tools change's notice.
- [The grouping rule changes] → VTAC says groupings are reviewed continually; the groupings table is per study year and the rule tests run against each stored year.

## Open Questions

- Whether VCAA's terms allow reuse of key dates as own-words facts without asking (the VCAA request in `add-course-data-permissions` covers it either way).
- Whether to store more than one past scaling year, for "how has Chemistry scaled lately?" questions.
