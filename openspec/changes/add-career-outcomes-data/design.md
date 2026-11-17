## Context

JSA publishes occupation and industry profiles and projections, mostly as downloadable spreadsheets. The exploration confirmed the site licence (CC BY 4.0) but opened no data file. The pattern to follow is `add-health-cover-data`: verify the real file first, load in one transaction, keep nulls as nulls, show the as-of date.

## Decisions

1. **Verify files first.** Task 1.1 downloads the candidate files and writes `docs/career-outcomes-columns.md`. Datasets that are frozen, unlicensed or not occupation-level are dropped here, and the proposal updated.
2. **Own tables, rebuildable.** `career_occupations` (code, title, classification and version), `career_profile_facts` (occupation, measure, value, unit, period), `career_projections` (occupation, base year, horizon, employment, growth), `career_load`. Replace-all in one transaction; the files are the source of record.
3. **Keep the publisher's classification.** Store occupation codes with the classification name and version (ANZSCO or OSCA) exactly as the file states. Do not map between versions in this change.
4. **Facts as published.** Values, units and reference periods are stored as stated; a missing value is null and shown as "not published". We never compute our own outlook score.
5. **Course link is out of this change.** Joining occupations to courses needs a mapping the publisher states (for example typical qualification level or field of education). Whether JSA publishes one is unknown; task 1.4 records the answer and the tools change decides what to offer.
6. **Rights.** New entry `career-outcomes`: basis `open_licence`, status `cleared_pending_legal_view`, evidence the labourmarketinsights.gov.au copyright page and each dataset record, attribution wording from the page (the exact wording was not readable on 17 Nov 2026, so task 1.2 records it). Conditions: logos, coat of arms and third-party material excluded; written authorisation needed for uses beyond the licence.
7. **Staleness.** Registry `maxAgeHours` set once the cadence is known; results carry the file's reference period and release date.

## Risks / Trade-offs

- Licence varies by dataset on data.gov.au (CC BY 2.5 AU, some frozen). Each loaded file records its own licence.
- Classification changes (ANZSCO to OSCA) can break joins later; storing the version keeps old data usable.
- The site copyright page does not say commercial reuse is allowed in words; CC BY 4.0 does, but this goes in the legal view.

## Open Questions

- Which JSA files carry occupation outlook and projections, and in what layout?
- Is there a stated link from occupation to qualification or field of study?
- What attribution wording does JSA require?
