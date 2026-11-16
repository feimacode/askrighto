# Scorecard

Version 1 (draft). Fill one row per prompt per host. Coverage, freshness and rights readiness come from `npm run compare:usecases`.

## Data-side measures

| Measure | Domestic | International |
| --- | --- | --- |
| Rows loaded | | |
| Key-fact coverage (domestic: entry figure, prerequisite rule; international: fee, duration, location) | | |
| Share curated (domestic only) | | n/a |
| Source age in days | | |
| Rights ready in production mode | | |
| Columns not found (international) | n/a | |

## Prompt runs

| Prompt | Host | Browsing assistant | Tools called | Outcome counts before to after | Grounded (yes/no) | Completeness (no browsing / with browsing / not answerable) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Summary per use case

| | Domestic | International |
| --- | --- | --- |
| Prompts run | | |
| Grounded share | | |
| Answered without browsing | | |
| Answered only with browsing | | |
| Not answerable | | |
| Ungrounded figures seen | | |

## Decision rules (draft, for Iven to confirm)

A use case is a promotion candidate only if all hold:

1. Rights readiness passes in production mode.
2. At least 80 percent of prompt answers are grounded.
3. No prompt produced an ungrounded figure.
4. The oldest source behind an answer is under 45 days old.

The use case with more prompts answered without a browsing assistant goes first, unless Iven decides otherwise. Promotion itself follows `docs/promotion-checklist.md` and needs Iven's go.

| Rule | Domestic | International |
| --- | --- | --- |
| 1 Rights ready | | |
| 2 At least 80% grounded | | |
| 3 No ungrounded figure | | |
| 4 Data under 45 days old | | |
| Candidate for promotion? | | |
