# Scorecard

Version 2 (draft; prompts D01–D31 and I01–I30, with mechanical checks). Fill one row per prompt per host. Coverage, freshness and rights readiness come from `npm run compare:usecases`.

## Data-side measures

| Measure | Domestic | International |
| --- | --- | --- |
| Rows loaded | | |
| Key-fact coverage (domestic: entry figure, prerequisite rule; international: fee, duration, location) | | |
| Share curated (domestic only) | | n/a |
| Source age in days | | |
| Rights ready in production mode | | |
| Columns not found (international) | n/a | |
| Rows by region (vic, nsw-act, qld) | | n/a |
| Rows by sector (higher education, VET, not stated) | n/a | |

## Prompt runs

| Prompt | Host | Browsing assistant | Tools called | Mechanical checks failed (prompt table column 5) | Outcome counts before to after | Grounded (yes/no) | Completeness (no browsing / with browsing / not answerable) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Summary per use case

| | Domestic | International |
| --- | --- | --- |
| Prompts run | | |
| Grounded share | | |
| Answered without browsing | | |
| Answered only with browsing | | |
| Not answerable | | |
| Ungrounded figures seen | | |
| Prompts with a failed mechanical check | | |
| Regions and sectors covered (domestic: vic, nsw-act, qld; international: higher education, VET) | | |

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


## Health cover (add-health-cover-evaluation)

Prompt set: `health-prompts.md` (H01 to H20). The data-side facts come from `npm run compare:usecases` once the health case is added to the report (not built yet; read the file date, insurer and product counts from `list_data_sources` until then).

| Measure | Value |
| --- | --- |
| Product file date and age in days | |
| Insurers and product variants loaded | |
| Share of products with a published premium | |
| Share with a published after-rebate premium | |
| Oldest rule page date; any rule past its review date | |
| Rights status of `health-cover-products` and `health-cover-rates` | |

Per prompt, record the usual columns plus these checks: disclosure line present in the first reply; "insurer's quote governs" on every calculated figure; no banned or directive wording (best, right for you, should, recommend, worth it, promises of saving); proposed rebate change called proposed and not law; no condition passed to a tool.

Calculator accuracy sample (a promotion gate): at least ten products, the calculated premium after rebate against an insurer-published figure, with each difference explained.

| Product id | Tier and age band | Calculated | Insurer's figure | Difference and cause |
| --- | --- | --- | --- | --- |
