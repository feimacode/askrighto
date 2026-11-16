# Proposal

## Why

The course tools need careful intake and strict wording: VCE studies before prerequisite checks, an aggregate is not an ATAR, no odds of entry, `curated` versus `index_only` handling, and no visa or migration advice for international students. These are workflow and tone rules that suit skills.

## What Changes

- Add `vce-course-research`: intake of VCE studies, prerequisite check before course talk, figures quoted with kind and intake year, no odds, aggregate never converted, curated versus index-only handling including the guided-browsing reading checklist.
- Add `intl-course-finder`: field, level, institution and CRICOS code intake, indicative fees, the entry checklist, and a hard rule of no visa or migration advice with a pointer to official sources.
- Both skills are written now but are not listed in the public marketplace entry until their vertical passes the promotion gates in `docs/promotion-checklist.md`.

Out of scope: a Claude-only course-page-reader agent (revisit after guided browsing is tested in Claude in Chrome), new tools.

## Capabilities

### New Capabilities

- `course-skills`: workflows and guardrails for domestic and international course skills.

### Modified Capabilities

None.

## Impact

- New files under `plugin/skills/` and `docs/skills/`; marketplace config keeps them unlisted until promotion.
- Depends on `add-host-guidance`, and on the course verticals' promotion.
