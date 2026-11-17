## Why

The case is complex because of the tax maths, not the policy list: the same premium costs different amounts after the government rebate (by income tier and age), the Medicare levy surcharge (MLS) can make hospital cover cheaper than going without, and the Lifetime Health Cover (LHC) loading raises the premium for people who joined late. These rules change on fixed dates (1 April, 1 July) and one change is **proposed but not law** (rebate for people 65 and over, from 1 April 2027). Hard-coding them would break trust the first time they move. This change stores them as dated, sourced reference data.

## What Changes

- A dated `health_rates` store (small YAML under `data/health/`, loaded into PostgreSQL) holding: rebate income tiers and percentages by age band, MLS tiers and rates, the family threshold child increment, LHC rules, and the MLS-exempt excess limits.
- Every rule row carries its source URL, the page's own last-updated date, the date we read it, an effective-from and effective-to date and a `status` of `in_force`, `legislated_future` or `proposed`.
- A pure rules evaluator (`src/health/rules.ts`) that picks the rules in force on a given date and refuses to use `proposed` rows for any calculation.
- A check each 1 April and 1 July (and when the ATO page changes) that the stored tiers match the published ones, plus a release check that fails when a rule is older than its review date.

Data sources: ATO rebate and MLS threshold pages (read 17 Nov 2026, updated 22 June 2026), ATO Lifetime Health Cover page (updated 5 May 2026), Department of Health rebate-change page (proposed change). Licence of ATO and Department of Health content: **unverified**, likely CC BY 4.0; task 1.1 confirms. Refresh cadence: reviewed every 1 April and 1 July, and whenever Parliament passes a change.

Hosts affected: none directly; the tools change exposes these rules.

Out of scope: the tools that use the rules (`add-health-cover-tools`), personal tax advice, how "income for MLS purposes" is worked out beyond a stated definition and link, rebate claimed through the tax return versus reduced premium (stated as a fact only), state-based concessions.

## Capabilities

### New Capabilities
- `health-cover-rates`: dated, sourced tax and loading rules with an in-force check.

### Modified Capabilities
None.

## Impact

- New `data/health/rates.yaml`, loader `health:rates-load`, module `src/health/rules.ts`, rights entry `health-cover-rates`.
- Review dates in `docs/data-rights.md` for the ATO and Department of Health pages.
