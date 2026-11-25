# Tasks

Planning only. Nothing here is built until Iven says go.

## 1. Build

- [ ] 1.1 Add `src/energy/features/free-hours.ts`: `freePeriods(plan)` with the classes `free`, `daytime`, `capped` and the counted reasons `zero_all_day`, `conflicting_windows`. Tests: midday window, overnight window, window crossing midnight, all-day placeholder, overlap, capped block, seasonal period, controlled load ignored, name never decides
- [ ] 1.2 Add `src/energy/features/feed-in.ts`: `feedInSummary(plan)` with eligibility (payer, scheme, dates, FLEXIBLE) and the reasons `varying_in_shape_only`, `legacySchemeSkipped`, `flexibleSkipped`. Tests use `solar-time-varying.json` plus new fixtures (volume-limited peak, government premium, all windows equal)
- [ ] 1.3 Extend `search_energy_plans`: `fuelType` DUAL, `pricingModel`, `freeHours`, `solarFeedIn` (with `hasSolarFeedIn` kept as `ANY`), `sortBy`; evidence columns only when a feature filter is used; `mentionedOnly` (cap 10); `byRetailer`; the not-a-cost line; the ordering caveat. Descriptions say which inputs combine
- [ ] 1.4 Move the distributor question to the postcode's single-fuel plans before filters (fixes dual-only results). Test: dual-only result at a postcode with two networks asks the question
- [ ] 1.5 Retailer aliases: add `aliases` to `retailers.json`, try them first in `matchRetailer`, add legal-entity words to the generic list in `brands.ts`, add the entity-name test table (AGL Sales Pty Limited, Origin Energy Electricity Limited, Red Energy Pty Ltd, EnergyAustralia Pty Ltd and others found in task 2.1)
- [ ] 1.6 Locality data: migration for the `localities` table, `load-localities` command (parse the ABS SAL to POA file, drop pairs under the share threshold, idempotent), dataset registration, repository with the matching tiers
- [ ] 1.7 Add `find_postcodes` (title, readOnlyHint, destructiveHint, openWorldHint set; flat inputs; refuses a street address). Register on the energy vertical. Have search's postcode `needs_input` message name it
- [ ] 1.8 Measure today's 20-row and 50-row search result size, set the budget (no more than 25% over today's 20-row page for a feature search), and add the test that builds the largest realistic page
- [ ] 1.9 New journey `energy-find-plans` (`src/guidance/energy/energy-find-plans.md`): add to `JOURNEY_IDS`, regenerate `journeys.generated.ts`, run `plugin:sync` and `guidance:check`, update the `get_energy_guide` description. Edit `energy-start` (listing needs no invoice; cost does) and the shared energy rules (no "best" for a feature; "free" only with window and conditions)
- [ ] 1.10 Update `src/energy/instructions.ts` (one line), `docs/areas/energy-plans.md`, and add eval prompts `E32` to `E40`: current retailer by name and by invoice entity name; dual fuel in Box Hill by suburb; Box Hill with no state; Box Hill North; free daytime hours; a plan named like free power with no zero rate; time-of-use plans with a peak feed-in window; sort by feed-in with the caveat; a WA suburb
- [ ] 1.11 Answer-review: add the new wording rules to the `ask-righto-answer-review` checks (no "best", no saving claim for a free window)

## 2. Data checks (needs the WSL database; cloud sessions cannot reach it)

- [ ] 2.1 Run the appendix queries in `design.md` on `askrighto_dev` with all retailers loaded (the current load may hold only some). Record counts and sample rows in `docs/research/energy-plan-search-data-check.md`. Also list brand names with more than one spelling, and the entity names printed on invoices Iven can share, to build the alias list
- [ ] 2.2 Compare query A (zero-rate windows) with query B (names). For every plan in one list but not the other, read its rate sheet on Energy Made Easy (outside VIC) or the retailer page (VIC) and record why. Use this to fix the word list for `mentionedOnly` and to decide open question 4
- [ ] 2.3 Fix the minimum window (one hour assumed), the all-day limit (20 hours assumed) and the daytime span (07:00 to 18:00 assumed) from the real windows. Check whether near-zero rates (for example 1 c/kWh) are common enough to need a separate class
- [ ] 2.4 Dual plans: confirm what `geography.distributors` holds for a postcode with several electricity or gas networks (query D at 3128 and one more), and whether `compare_energy_plans` and `get_energy_plan` handle it
- [ ] 2.5 Read the ABS SAL to POA file, check Box Hill (VIC and NSW), a suburb in two postcodes and a suburb in two states, and set the share threshold
- [ ] 2.6 Check whether the plan data carries a time zone for windows and whether any retailer publishes daylight-saving-shifted windows
- [ ] 2.7 Run the new prompts on the WSL against real data and check three free-hour plans and three time-varying feed-in plans against their rate sheets

## 3. Before shipping

- [ ] 3.1 Check the licence of the suburb to postcode source (ABS ASGS correspondence, CC BY 4.0, and G-NAF as the fallback) and record the attribution wording. If neither is cleared, ship without `find_postcodes`
- [ ] 3.2 Check the CDR plan data licence (rule 2.6) is still current
- [ ] 3.3 Host runs on Claude, ChatGPT and Gemini for the four questions (the schema is longer; check Gemini strict mode accepts the new enums)
- [ ] 3.4 Update `docs/skills/activation-prompts.md` for `energy-find-plans` and run it
