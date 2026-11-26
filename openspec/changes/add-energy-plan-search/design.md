## Context

What is on `main` today (checked at `dab2abc`, after PRs #89 to #93):

- `search_energy_plans` (`src/tools/search-energy-plans.ts`) requires `postcode` and `customerType` and filters in memory over `store.plans({ postcode, customerType })`, which returns every current plan at that postcode with its full normalised contract. Filters: `fuelType`, `retailer`, `distributor`, `planType`, `hasSolarFeedIn`, `hasControlledLoad`. Rows hold the plan id, retailer, name, fuel, type, tariff label, distributors, link and update date. Default 20 rows, maximum 50.
- `compare_energy_plans` selects plans the same way (`selectPlans`) and costs them. `list_current_plan_options` picks the household's current plan from an invoice. `compare_energy_plan_rates` lines up 2 to 5 named plans.
- The normaliser (`src/energy/normalise.ts`) already keeps what free-hour and feed-in detection need, so **no new plan data and no migration for the filters**:
  - usage rates per tariff period, as `timeOfUse[]` with `type`, `displayName`, `rates[]` (scaled integers, so zero is exactly `0`) and `windows[]` (days, start, end);
  - solar feed-in with `scheme`, `payerType`, dates, a single tariff or `timeVaryingTariffs[]` with `rates[]` and windows (an array since Get Generic Plan Detail v3, PR #13);
  - discounts, incentives and eligibility with their text.
- What the CDR schema (1.35.0, `EnergyPlanDetailV3`, see `docs/cdr-schemas.md`) offers for these features: **nothing explicit.** There is no "free power" flag, no plan tag and no standard name for a free window. `timeOfUseRates[].type` is an enum (`PEAK`, `OFF_PEAK`, `SHOULDER`, `SHOULDER1`, `SHOULDER2`, `SOLAR_SPONGE` for controlled load), and `displayName` is free text chosen by the retailer. Free hours therefore exist, if at all, as a time-of-use rate with a unit price of zero and a window, or as a discount or incentive described in words. Time-varying feed-in is explicit in the schema (`tariffUType: timeVaryingTariffs` with windows).
- Known data facts: AGL labels two bands `SHOULDER`, so names and types cannot be trusted. Momentum publishes a single feed-in of `0.00` as a placeholder (recorded fixture `momentum-united-energy-3128.json`), so a zero is not always a promise. Window times are published in the plan's time zone (default AEST), which `normalise.ts` does not read yet.
- There is no suburb data in the repo. `src/energy/benchmarks` maps postcodes to climate zones, not suburbs.

## Decisions

1. **Filters on `search_energy_plans`, plus one small lookup tool.**
   - Filters, not a second search tool. The base is the same (postcode, customer type, network), a host picks between two near-identical search tools badly, and the four questions combine freely ("AGL dual fuel with free hours"). New inputs are optional, flat and enum-or-boolean, within the flat-schema rule in `openspec/config.yaml`.
   - A separate `find_postcodes` tool rather than a `suburb` input on search. A suburb can span postcodes and share a name across states (Box Hill is in VIC and NSW). A server-side guess would silently show the wrong plans, and plan eligibility is by postcode. A separate call lets the host put the candidates to the user, and the result carries its own source and date. The cost is one extra call, and search's `needs_input` message names the tool.
   - Rejected: one `find_plans` tool that takes natural language. It would move parsing into the server and break the "figures come from tools, the host narrates" split.

2. **Retailer filter and aliases.**
   - Keep `matchRetailer` (exact, then prefix or contains, then edit distance two, several equal hits return candidates). Add a curated `aliases` array per retailer in `retailers.json` and try it as the first tier. It is for names people use that the brand name does not contain.
   - Invoice entity names ("Origin Energy Electricity Limited", "AGL Sales Pty Limited", "Red Energy Pty Ltd") are matched by stripping legal-entity words (`limited`, `sales`, `retail`, `electricity`, `gas` join the generic list in `brands.ts`). A test table of entity name to brand is the check.
   - "Current retailer": the skill reads it from the invoice, or asks once, and passes it as `retailer`. When the invoice was already read for `list_current_plan_options`, the retailer is the same value. Nothing is stored. A retailer with no plans at the postcode returns the existing `not_in_dataset` result.
   - A path that serves several brands (Energy Locals) keeps one entry per brand, as today.

3. **Dual fuel.**
   - `fuelType` gains `DUAL`. `ELECTRICITY` and `GAS` keep meaning "includes that fuel" (dual plans included), and the description says so. `DUAL` matches `plan.fuelType === "DUAL"`.
   - Fix for networks: `distributorsByFuel` and `needsDistributor` are now computed from the postcode's single-fuel plans before any filter, because the network is a property of the place, not of the filter. Today a dual-only result has no single-fuel plan on the page, so the network question is never asked.
   - A dual plan's `geography.distributors` is one flat list covering both fuels, so the `distributor` filter matches any entry. The data check (tasks 2.4) confirms what the list means for postcodes with more than one network.
   - Pairing two single-fuel plans is out of scope. Each result says how many electricity-only and gas-only plans the matched retailer has at the postcode, so the host can tell the user that a bundle of two plans exists but is not compared here.
   - `compare_energy_plans` costs one fuel at a time. Costing a dual plan's bundle discount needs both fuels' usage, which is a separate change (open question 5).

4. **Free hours: detect from rates, not names.**

   A detector is a pure function `freePeriods(plan)` in `src/energy/features/free-hours.ts`, run over the stored contract at request time. Per electricity tariff period, per `timeOfUse` usage rate (controlled load is never read):

   - **Zero.** Every block rate of the rate has `unitPrice === 0`. Stored as scaled integers, so there is no rounding. GST does not change zero.
   - **A window.** At least one window of at least one hour, with a start and an end. A window that crosses midnight (start after end) is split. An 'end' of `24:00` or `00:00` is midnight.
   - **Evidence kept.** Days, start and end, season (the tariff period's dates, or the whole year), hours per day, the rate's published `type` and `displayName` (shown, never used to decide), the plan's `eligibility` entries and conditional discounts (shown beside the window, never used to drop the plan).
   - **Classes.**
     - `free`: all blocks zero, window of one hour or more and under 20 hours a day. This is what `freeHours` matches.
     - `daytime`: a `free` window that lies within a daytime span (first guess 07:00 to 18:00; bounds fixed after the data check, task 2.3). `freeHours: DAYTIME` matches this, `ANY` matches any `free` window. An overnight free window is a real feature (EV charging) and stays under `ANY`.
     - `capped`: the first block is zero with a volume limit and a later block is priced (for example "free up to 10 kWh a day"). Not a match. Listed in the second tier.
   - **False positives handled** (each is a counted reason in the result, so a reviewer can see what was set aside):
     1. *Placeholder zero.* A zero on an all-day or near all-day window (20 hours or more on every day), or a zero on a single-rate plan, is `zero_all_day`: not free hours. (The Momentum feed-in zero shows retailers publish zero placeholders.)
     2. *Overlap.* Another non-zero usage rate in the same tariff period covers the same days and hours: `conflicting_windows`. Not matched, because the data contradicts itself. Counted and shown in the review list of the data check.
     3. *Controlled load, demand and feed-in zeros.* Never read as usage.
     4. *Short window.* Under one hour: ignored.
     5. *Capped or conditional.* A conditional discount or an eligibility entry does not remove the plan. The window is returned with the condition printed next to it, and the skill tells the host to say so. A plan whose free window is described only inside a conditional discount goes to the second tier.
     6. *Name matching.* A name such as "Midday Power Saver" proves nothing and is never a match on its own.
   - **Second tier ("mentioned, rates do not show it").** A plan with no `free` window whose name, description, discounts or incentives contain a short, reviewed word list (free, power hours, midday, sharer, "$0"; the list is tuned in task 2.2 against the real data) is returned in a separate `mentionedOnly` list, capped at 10, each with the matched text and the plan link. It is never counted in `total`. This catches free hours the rates do not show (a credit, a bill discount), and the wording says "check the rate sheet".
   - **False negatives to expect.** Free power sold as a bill credit, a conditional discount or a battery-linked offer will not show as a zero rate. A user who knows their retailer offers one may not see it. The result says that the match is by published rates.
   - **Time zone and daylight saving.** Windows are shown as published, with the plan's stated time zone if the data check finds one. The tool never converts them.
   - **No "saving" claim.** A zero rate for some hours says nothing about the yearly cost. The result states that a plan with free hours can have higher rates or supply charge at other times, and points to `compare_energy_plans` for cost.

5. **Time-of-use plans with a solar benefit.**

   `src/energy/features/feed-in.ts`: `feedInSummary(plan)` over `electricity.solarFeedIn`:

   - **Eligible feed-in.** Skip entries with `payerType` GOVERNMENT or `scheme` PREMIUM (closed legacy schemes, not offered to a new customer; still shown in `get_energy_plan`), entries whose dates exclude today, and plans with `pricingModel` FLEXIBLE (the rate follows the wholesale market, so no fixed figure is published). These are counted: `legacySchemeSkipped`, `flexibleSkipped`.
   - **`TIME_VARYING` matches** a plan with an eligible feed-in that has two or more windows with **different** rates. A time-varying shape in which every window carries one rate, or a single all-day window, is `varying_in_shape_only` and not matched.
   - **What each match returns:** the highest published rate and its window (days, start, end), the lowest rate, the volume limit if the high rate is a first block ("for the first N kWh a day"), and the scheme. Rates are shown as published, with no GST added (the existing rule for feed-in).
   - **`sortBy: FEED_IN_RATE`** orders by the highest eligible published rate, descending, ties by retailer and name. The result states it is an ordering of one published figure, not of what a household receives: a volume limit, the window, the usage rates and the supply charge all change the outcome, and an export-reading estimate is out of scope. Wording rule: "highest published feed-in rate", never "best".
   - **Time-of-use solar** is the combination `pricingModel: TIME_OF_USE` and `solarFeedIn: TIME_VARYING`, or `ANY` when the user only wants a feed-in. `hasSolarFeedIn` stays for compatibility and means `solarFeedIn: ANY`; if both are given, `solarFeedIn` wins.
   - **Battery users.** The feed-in window is what matters when export timing is controlled, so the evidence row shows the window and its rate, not only the highest number.

6. **`pricingModel` filter.** `SINGLE_RATE`, `TIME_OF_USE`, `FLEXIBLE`. The stored `_CONT_LOAD` variants map to the base value (`hasControlledLoad` stays separate). `QUOTA` and unknown models match none of the three, and are counted.

7. **Response size.** Compare results were too large; search must not repeat that.
   - Default stays 20 rows, maximum 50. Feature evidence is added only when a feature filter is used, shows at most 3 windows per plan and ends with "N more windows, see get_energy_plan".
   - When no `retailer` is named and there is more than one page, the result carries `byRetailer` (name and count), so the host can narrow instead of paging.
   - The row's `distributors` array stays, the `link` object stays (it carries the rate sheet label the host must quote), and the text table gets one `Features` column.
   - A test builds the largest realistic page (50 rows, each with 3 free windows and feed-in windows) and fails if the JSON passes a budget set from today's measured page (task 1.8). The shortlist then goes to `compare_energy_plans` or `compare_energy_plan_rates` as `planIds`, never the whole list.

8. **Suburb to postcode (`find_postcodes`).**
   - Input: `place` (suburb or locality name) and optional `state`. Output: for each match its name, state and postcodes (most of a suburb's population first), or candidates when the name exists in several states, or a not-found. The result carries the dataset's source, licence and release date, like any lookup.
   - Matching: normalise (case, punctuation, "St" and "Saint", "Mt" and "Mount"), exact, then prefix, then edit distance one. Several equal hits return candidates and the host asks the user. A hit whose postcode has no energy plans (WA, NT) returns the existing coverage message.
   - Data: a `localities` table (name, normalised name, state, postcode, share of the suburb in that postcode, dataset version), loaded by a `load-localities` command from the ABS SAL to POA correspondence file, rebuildable from the source, with pairs below a small share dropped (threshold set in task 2.5). Same pattern as the benchmark load (`benchmarks:load`, migration 8). A dataset entry is registered with a long maximum age (a fixed reference set).
   - Licence and fallback: if the ABS file cannot be reused as needed, G-NAF is the second candidate; if neither is cleared, the tool is not shipped and the skill asks the user for a postcode (the status quo). The Australia Post file is not used.
   - The tool receives a place name only, no address.

9. **Guidance.**
   - New journey `energy-find-plans` (source `src/guidance/energy/energy-find-plans.md`, a plugin skill, and a `get_energy_guide` journey id, so `JOURNEY_IDS`, the generated file and the plugin copy are updated with `guidance:check` and `plugin:sync`).
   - It covers: ask home or business; get the postcode (use `find_postcodes` for a suburb and confirm the postcode with the user); name the retailer from the invoice or ask once; choose filters from the user's words; present results with the evidence columns and the conditions printed with them; say a feature is not a cost; offer `compare_energy_plans` (usage needed) or `compare_energy_plan_rates` (2 to 5 ids) next.
   - `energy-start` step 2 ("latest invoice first, before any tool call") is split: listing and filtering plans needs no invoice. A cost, a "better plan" question or a bill split still starts with the invoice.
   - Wording rules added to the shared energy rules: never "best", "cheapest" or "worth it" for a feature; "free" only with the window and the conditions the result gives; the match is by published rates, and a retailer's marketing name proves nothing.
   - Server instructions (`src/energy/instructions.ts`) get one line naming the new filters and `find_postcodes`; the tool descriptions carry the contract.

10. **Source and date.** Search keeps its source (AER product reference data), licence and `asOfFor`. `find_postcodes` carries its own dataset source, licence and release date. Evidence rows are derived from stored plan data and carry the plan's `sourceLastUpdated`.

## Risks / Trade-offs

- **Detection may not match how retailers publish free hours.** The design is a hypothesis until real plans are queried: a retailer may publish free midday power as a discount or as a zero rate with an odd window. Task 2 runs the queries first, and thresholds, the daytime span and the word list are set from what is found, not from this document.
- **A zero rate is a published rate, not a saving.** Mitigated by wording and a test on the result text.
- **Sorting by feed-in invites "best".** Mitigated by naming it a figure ordering, the volume-limit column and the skill rule. If Iven prefers, drop `sortBy` and leave the order by retailer (open question 2).
- **Flat-schema growth.** Five optional inputs are added to a tool that already has ten. They are enums and booleans with one-line descriptions. If hosts misuse them, the fallback is to move the feature filters into one `features` enum, which costs the combinations.
- **Locality data licence is unverified.** The tool is gated on task 3.1.
- **Dual fuel network meaning is unverified** until task 2.4.

## Open Questions

1. Is ABS SAL to POA (CC BY 4.0, to confirm) acceptable as the suburb source, or should G-NAF be checked first?
2. Is `sortBy: FEED_IN_RATE` acceptable under the no-"best" rule, or should results stay in retailer order?
3. Is a one-hour minimum and a 07:00 to 18:00 daytime span the right first guess for "free hours" (the Solar Sharer style window is not verified here and is not stated by the tool)?
4. Keep the second tier ("mentioned, rates do not show it"), or drop it as name matching by another route?
5. Should dual fuel costing (both fuels' usage and bundle discounts) be a separate change after this one?
6. Data checks need the WSL database. Can they run through Remote Control when this proposal is approved?

## Appendix: data check queries (read-only, WSL `askrighto_dev`)

`plans.contract` holds `{ electricity, gas }` as JSON; money is scaled by 100000, so zero is `0`.

```sql
-- A. Time-of-use usage rates with every block priced at zero, with their windows
SELECT p.brand_name, p.display_name, p.plan_id, tp->>'startDate' AS s, tp->>'endDate' AS e,
       r->>'type' AS band, r->>'displayName' AS rate_name, r->'windows' AS windows
FROM plans p,
     jsonb_array_elements(p.contract->'electricity'->'tariffPeriods') tp,
     jsonb_array_elements(COALESCE(tp->'timeOfUse', '[]')) r
WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'rates') x WHERE (x->>'unitPrice')::bigint <> 0)
  AND jsonb_array_length(r->'rates') > 0;

-- B. Names that suggest free power, to compare against A (false negatives and false positives)
SELECT brand_name, display_name, plan_id FROM plans
WHERE display_name ~* '(free|sharer|midday|power hour|saver|boost)';

-- C. Time-varying feed-in: windows, rates, scheme, payer
SELECT p.brand_name, p.display_name, f->>'scheme' AS scheme, f->>'payerType' AS payer, f->'timeVaryingTariffs' AS tv
FROM plans p, jsonb_array_elements(p.contract->'electricity'->'solarFeedIn') f
WHERE (f->>'timeVarying')::boolean;

-- D. Dual plans: what geography.distributors holds where a postcode has several networks
SELECT p.plan_id, c.distributors FROM plans p JOIN coverage_sets c ON c.id = p.coverage_id
WHERE p.fuel_type = 'DUAL' AND c.included_postcodes @> ARRAY[3128];
```
