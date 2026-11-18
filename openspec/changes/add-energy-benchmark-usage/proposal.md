# Proposal

## Why

`compare_energy_plans` refuses to estimate without usage figures from a bill. Many people asking "which plan suits me?" have no bill to hand. A typical-usage estimate, clearly labelled as typical and not theirs, is the last tier of the accuracy ladder (interval data, then bill, then benchmark). The AER publishes open benchmark figures made for exactly this: household electricity and gas use by season, climate zone and household size.

This change **reverses one line of `add-energy-plan-tools`**, which listed "Guessing usage from household size, or usage benchmarks" as out of scope. The reversal is limited: the figure is a published AER benchmark with its source, never a model guess, and it is only used when the person asks for it or has no usage to give.

## What Changes

- Load the AER "Simple electricity and gas benchmarks" workbook into new tables: seasonal kWh and MJ by climate zone, state, household size, plus the postcode-to-zone map (including the ten South Australian zones).
- Add a lookup that turns (postcode, fuel, household size) into an annual benchmark with its four seasonal values, source URL and as-of date, or an explicit not-found.
- Extend `compare_energy_plans` with `householdSize` (1 to 5) and `useBenchmarkUsage`. When no usage figure is given and `useBenchmarkUsage` is true, the tool uses the benchmark annual figure. Without `useBenchmarkUsage` the "needs usage" error stays, now telling the host it may offer the benchmark.
- Mark every such result `usageBasis: "benchmark"` (bill-based and stated usage are `"customer"`), with the benchmark source, zone, household size and a banner: typical usage for a household of that size in that zone, not the person's own, so real cost can differ a lot.
- Time-of-use plans stay not estimated (`needs_time_of_use_split`): a benchmark has no peak, shoulder or off-peak split. Controlled load and solar export are not benchmarked and are left out, and the result says so.
- Add a server-instruction and skill line: ask for a bill first, offer the benchmark only if there is none, and always say it is typical usage.

Data source: AER "Simple electricity and gas benchmarks, published December 2020, updated June 2021 for postcodes" (analysis by Frontier Economics), downloaded from aer.gov.au. Licence: CC BY 4.0 per the AER website's general statement (exceptions: logos, Coat of Arms, third-party content, material marked otherwise); the workbook states no exception. Attribution: Australian Energy Regulator, with Frontier Economics analysis. Refresh cadence: none fixed. The 2020 set is the current edition found; the loader is re-run if the AER publishes a new one.

Hosts affected: Claude, ChatGPT and Gemini, through the existing `compare_energy_plans` tool; the new input fields are flat and optional.

Out of scope:

- Interval data upload and CDR data recipient status (parked, see roadmap).
- Time-of-use splits from benchmarks, controlled load or solar benchmarks.
- Western Australia and the Northern Territory. They are outside the NEM and the AER regime and out of scope for all energy plan work, so their absence from the AER data is not a gap.
- Adjusting for pools, heating type, dwelling type or solar presence. The benchmark is a typical household, reweighted by the AER to the population's solar and mains gas share.
- Concession questions and fixed-dollar discounts (separate changes).
- Using benchmarks to rank "best" or recommend a plan.

## Capabilities

### New Capabilities

- `energy-benchmark-data`: stored AER benchmark figures and the postcode-to-zone lookup, with source and as-of date.

### Modified Capabilities

- `energy-plan-comparison`: usage may come from a labelled benchmark when none is given.

## Impact

- New: migration `0008-energy-benchmarks.ts`, `src/energy/benchmarks/` (parser, loader, lookup), CLI `benchmarks:validate` and `benchmarks:load`, `docs/energy-benchmarks.md`, a rights entry `aer-benchmarks` in `src/core/rights.json` and `docs/data-rights.md`.
- Changed: `src/tools/compare-energy-plans.ts`, `src/energy/calc.ts` (`Usage.basis`, no maths change), render module and notice text, server instructions, the energy bill skill.
- Needs a database to load, so the load and its tests run on the WSL (`askrighto_test`), not in cloud sessions.
- Depends on `add-energy-plan-tools`. Independent of the concession and fixed-dollar-discount changes.
