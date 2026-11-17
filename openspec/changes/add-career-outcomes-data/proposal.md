## Why

Course research (Phases 4 and 6) tells a student what they can study but not what the occupation looks like afterwards. The 17 Nov 2026 open data exploration (`docs/research/open-data-exploration-2026-11-17.md`) found one cleanly licensed source for that: Jobs and Skills Australia (JSA) Labour Market Insights, published under CC BY 4.0. This change loads it. It is a small extension of the course verticals, scored as case 14 in `ROADMAP.md` (Phase 8), and adds no new regulatory question.

## What Changes

- Load JSA occupation profiles and employment projections into new `career_*` tables under the `askrighto` schema, rebuildable from the source files.
- Add a `career-outcomes` entry to the rights register with the CC BY 4.0 licence, attribution wording and the excluded material (logos, coat of arms, third-party material).
- Refresh on an operator command, record each file's name, date and hash, and warn when the stored data is older than the publisher's current release.
- First task: open the real files from a machine that can reach the publisher (cloud sessions may be blocked), write `docs/career-outcomes-columns.md`, and decide which datasets are actually in scope. Field names, classification (ANZSCO or OSCA), file layout and release cadence are unverified.

Data source: Jobs and Skills Australia Labour Market Insights (`https://labourmarketinsights.gov.au`, copyright page read 17 Nov 2026: CC BY 4.0 unless stated, attribution required) and JSA datasets on data.gov.au. Check each dataset's own licence and date: the Entry Level Labour Markets dataset there is CC BY 2.5 AU and marked never updated (last updated Aug 2023). Refresh cadence: to be confirmed in task 1.1, then at least once a year.

Hosts affected: none directly; Claude, ChatGPT and Gemini through `add-career-outcomes-tools`.

Out of scope: tools (`add-career-outcomes-tools`), graduate salary and employment by institution (QILT, licence unread), wage forecasts or our own projections, job listings, visa or skilled migration lists, anything scraped from the Labour Market Insights website pages.

## Capabilities

### New Capabilities
- `career-outcomes-data`: a rebuildable store of occupation profiles and projections with provenance and attribution.

### Modified Capabilities
None. Reuses the rights register and migration runner.

## Impact

- New migration, module `src/careers/`, CLI commands `careers:load` and `careers:validate`, rights entry `career-outcomes`.
- New vertical id `career-outcomes` (added by the tools change), internal route first.
- Operator step on each JSA release, like `intl:load`.
