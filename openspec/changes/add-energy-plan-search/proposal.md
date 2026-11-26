# Proposal

## Why

`search_energy_plans` lists plans at a postcode and can narrow by retailer, fuel, network, plan type, solar feed-in and controlled load. Iven (25 Nov 2026) wants it to answer the questions people actually type:

1. "Find the plans from my current retailer, or from a named retailer such as AGL."
2. "Find the dual fuel plans from AGL in Box Hill", or at a postcode.
3. "Find the plans with free hours." Free midday power is a recent feature, sold under names such as Midday Power Saver and Solar Sharer. Names differ by retailer.
4. "Find the time-of-use plans with a solar benefit." People with a battery now choose when they export, so a higher feed-in rate in an evening window matters.

Today these fail in specific ways:

| Question | What happens now |
| --- | --- |
| Named retailer | Works through `matchRetailer`, but only by the published brand name and a fuzzy match. A nickname or a parent name ("Origin" for `Origin Energy`, "Energy Australia", "Red") has no alias table, and the "current retailer" has no route from the invoice to the filter. |
| Dual fuel | `fuelType` is `ELECTRICITY` or `GAS` and means "includes", so a dual fuel plan can only be found by chance. A dual fuel plan lists the networks of both fuels in one flat list, so `needsDistributor` and the distributor prompt are wrong for it. |
| Suburb | Only a postcode is accepted. There is no suburb data in the repo, and the start skill tells the host to ask for "postcode (or suburb)" with no way to turn a suburb into a postcode. |
| Free hours | Nothing. A zero usage rate in a daytime window is in the stored plan, but no tool reads it. |
| Solar in a time-of-use plan | `hasSolarFeedIn` is true for any feed-in. It does not say whether the feed-in varies by time, what the highest rate is or when it applies. |

## What Changes

- **`search_energy_plans` gains feature filters and feature columns** (flat inputs, no new search tool):
  - `fuelType` adds `DUAL`: plans that include both fuels in one plan.
  - `pricingModel`: `SINGLE_RATE`, `TIME_OF_USE` or `FLEXIBLE`.
  - `freeHours`: `ANY` or `DAYTIME`. Matches plans whose published usage rates include a window priced at zero (data detection, not names; see design).
  - `solarFeedIn`: `ANY` or `TIME_VARYING`. `TIME_VARYING` matches plans whose feed-in rate differs by time window.
  - `sortBy`: `NAME` (default) or `FEED_IN_RATE` (highest published feed-in rate first, a neutral figure ordering, not a recommendation).
  - When a feature filter is used, each row also carries the evidence: the free windows found (days, hours, season) or the feed-in windows and rates, with the published conditions.
- **A second tier for plans that only mention free power.** Plans with no zero-rate window but with free-hours wording in their name, discounts or incentives are listed apart as "mentioned, rates do not show it", never mixed into the matches.
- **New tool `find_postcodes`** (flat inputs: `place`, optional `state`): turns a suburb or locality into its postcode or postcodes from open data, with the source and as-of date. The host asks the user to confirm when there is more than one, then passes the postcode on. Search stays postcode-only.
- **Retailer aliases and a current-retailer route.** `retailers.json` gets curated `aliases`, and `matchRetailer` uses them before fuzzy matching. The skill tells the host to read the retailer from the invoice (or ask) and pass it to `retailer`.
- **Smaller results.** Rows stay compact, a per-retailer count is returned when no retailer is named, and a size budget is tested (see design).
- **Guidance.** A new journey, `energy-find-plans`, served as a skill and by `get_energy_guide`, covers the four questions. `energy-start` separates "list plans" (no invoice needed) from "cost plans" (invoice first).

Data sources:
- Plans: the existing AER Consumer Data Right product data (rule 2.6), refreshed by the daily sync. No new plan data and no migration for the filters: detection runs on the stored contract.
- Suburb to postcode: **a new open dataset, to be verified before it is loaded.** First candidate: the ABS correspondence between suburbs and localities (SAL) and postal areas (POA) in the Australian Statistical Geography Standard, released under CC BY 4.0 (to confirm). Second candidate: G-NAF from data.gov.au (licence to confirm). Not candidates: the Australia Post postcode file (not open) and community CSVs with no stated licence. Refresh follows ABS releases (about every five years for ASGS editions, with annual updates). One new table, rebuildable from the source.

Hosts affected: Claude, ChatGPT and Gemini. One new read-only tool and new optional inputs on one tool.

Out of scope:
- Any cost estimate, ranking by cost, "best" or "recommended" wording. Free hours and feed-in rates are published figures, not the cost of a plan: a plan with free hours can cost more over a year, and the result says so.
- Plans in WA and NT (outside the NEM and the AER regime).
- Pairing a separate electricity plan and a separate gas plan from one retailer. Only plans published as dual fuel are matched. The result says how many single-fuel plans the retailer has, so the host can mention it.
- Wholesale or "FLEXIBLE" plans' feed-in (a rate that follows the market is not a published rate). They are counted and left out of feed-in matches.
- Costing free hours or feed-in windows against the household's usage (that is `compare_energy_plans`, and a feed-in window needs export readings).
- Searching without a postcode (eligibility depends on it).

## Capabilities

### New Capabilities

- `energy-plan-search`: feature filters, evidence columns, retailer aliases and size limits for plan search.
- `energy-locality-lookup`: suburb or locality to postcode from open data.

### Modified Capabilities

None (the earlier changes have not been archived into `openspec/specs/`, so this proposal adds its own specs).

## Impact

- Changed: `src/tools/search-energy-plans.ts`, `src/tools/energy-common.ts` (`matchRetailer`), `src/energy/retailers.json` (aliases), `src/energy/store.ts` (a `DUAL` fuel type in `PlanQuery`), `src/guidance/energy/*` and `plugin/skills/*` (new journey, edited start), `src/energy/instructions.ts`, `docs/areas/energy-plans.md`, `docs/energy-evaluation/prompts.md`.
- New: `src/energy/features/` (free-hours and feed-in detection, pure functions over `EnergyPlan`), `src/tools/find-postcodes.ts`, `src/energy/localities/` (loader and lookup), one migration for the locality table, a `load-localities` CLI command, tests and fixtures.
- Depends on PRs #89 to #93 (already merged). Independent of `add-energy-concessions`.
- Needs real data checks before any threshold is fixed (see `tasks.md` section 2).
