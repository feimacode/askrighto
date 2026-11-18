## Context

The workbook (checked 18 Nov 2026) has one long-format sheet per climate zone 1 to 8, an `SA zones` sheet, a `Postcode mapping` sheet and one gas sheet per state (ACT, NSW, QLD, SA, TAS, VIC). Rows are (season, state, household size 1/2/3/4/5+, benchmark kWh or MJ). Zone sheets mix states (zone 4: NSW, SA, VIC), so a zone alone is not a key. The postcode sheet maps 2,244 postcodes to zones 1 to 8 and 340 SA postcodes to ten SA zones. Zones 7 and 8 share benchmarks, and the postcode list showed no zone 8; task 1.1 settles why. Electricity values are reweighted by the AER to the population's solar PV and mains gas shares. Some sizes and regions were pooled, so a few cells repeat.

## Decisions

1. **Own tables, rebuildable from the file.** `energy_benchmarks` (fuel, zone, state, household size, season, value, unit, source file, release), `energy_benchmark_postcodes` (postcode, climate zone, SA zone nullable), `energy_benchmark_load` (file name, hash, loaded at). Replace-all in one transaction, same pattern as the health and careers loaders. Values keep full precision and are rounded only for display.
2. **Key is (postcode, fuel, size, season).** The postcode gives state (from our existing postcode-to-state logic), climate zone and SA zone. Electricity in SA uses the SA zone rows; elsewhere the zone sheet row for that state. Gas uses the state sheet (ACT and TAS shared). A postcode with no mapping, or a state outside the data, returns `outside_coverage`.
3. **Annual figure is the sum of the four seasons.** The result also lists the four seasonal values so the host can show them. Seasons are the AER's calendar seasons.
4. **Explicit opt-in.** The tool does not silently fall back. If no usage is given: with `useBenchmarkUsage` it uses the benchmark; without, it returns the existing `needs_input` error, adding that the person may choose typical usage and giving the household-size question. This keeps "never guess" intact: the host must ask the person.
5. **Household size is asked, not guessed.** Values 1 to 5 (5 means 5 or more). Missing size with benchmark requested is `needs_input`.
6. **Basis travels with the number.** `Usage` gains `basis: "customer" | "benchmark"` and an optional `benchmark` record (zone, state, size, seasonal values, source URL, as-of, attribution). The estimate maths is unchanged; only labelling changes. The banner and the markdown/Inkview output show it above the table, and the standard notice gets one extra sentence.
7. **What a benchmark cannot do.** Time-of-use plans are listed as not estimated with the existing reason. Controlled load plans are costed for the main usage only, with "controlled load not included" in omissions. Solar feed-in credit is not computed (no export figure), and the omission says so. These are listed in the result, not hidden.
8. **Rights.** New entry `aer-benchmarks`: basis `open_licence` (CC BY 4.0, AER website general statement), evidence URL for the AER copyright page and the workbook page, attribution "Australian Energy Regulator (analysis by Frontier Economics), CC BY 4.0, values re-keyed unchanged", conditions as the AER lists. Status `cleared_pending_legal_view`, like the other open-licence datasets.
9. **Staleness.** The as-of date is the workbook's release (December 2020, postcodes June 2021). Results show it; the registry flags it as a fixed reference set, not a daily feed.

## Risks / Trade-offs

- Benchmarks date from 2020 survey data and mean use has moved with prices and solar uptake; the labelled banner and as-of date carry this. They are not shown as the person's cost.
- Averages hide a wide spread (a size 2 household can use half or double). The result must call it typical, never "your usage".
- A benchmark with no TOU split excludes many plans in states where TOU is common; the not-estimated list will be long. Accepted for now; a later change could add typical TOU shares only if an open source exists.
- Reweighting to population solar and gas shares means the number suits a typical mix, not an all-electric or solar home.
- Frontier authored the analysis; the AER publishes it under its site licence. The legal view should note that.

## Open Questions

- Why does the postcode sheet list no zone 8 postcodes, and where are those postcodes mapped (zone 7 sheet)?
- Do NSW zone 4 to 6 rows and SA zone rows ever disagree for the same SA postcode? Rule: SA zones win for SA.
- Should the benchmark also feed gas-only comparison in WA-like unsupported states? No, out of coverage.
