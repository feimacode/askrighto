# Energy benchmarks (typical household usage)

`compare_energy_plans` normally needs the kWh or MJ from a bill. When a person has no bill, and
agrees, it can use the AER's published **benchmark** instead: typical household electricity or gas
use for their postcode and household size. This page says what the data is, how it is stored and
looked up, and what it cannot do. Change: `add-energy-benchmark-usage`.

## What a benchmark is

The Australian Energy Regulator (AER) commissioned Frontier Economics to update its household
consumption benchmarks. The workbook gives, per season, the typical use of a household of 1, 2, 3, 4 or
5+ people in a climate zone (electricity, kWh) or a state (gas, MJ). The AER built them from survey
data and reweighted electricity to the population's share of solar PV and mains gas, so they suit a
typical mix of homes, not an all-electric or solar home. Some household sizes, states and zones were
pooled by the AER, so a few cells repeat; we return them as published.

It is **typical use, not the person's own**. A household of the same size can use half or double.
The data dates from the 2020 analysis (postcode map updated June 2021), and use has moved since.
Every result says all of this.

## Source and release

- Workbook: *Simple electricity and gas benchmarks - published December 2020. Updated June 2021 for postcodes* (XLSX, 582 KB).
- Page: <https://www.aer.gov.au/documents/frontier-economics-simple-electricity-and-gas-benchmarks-june-2021> (read 18 Nov 2026).
- Licence: the AER website's general CC BY 4.0 statement (<https://www.aer.gov.au/about/policies/disclaimer-copyright>); see `aer-benchmarks` in [`data-rights.md`](data-rights.md).
- Newer edition: none found on 18 Nov 2026. The National Energy Retail Rules require the AER to update the benchmarks at least every three years, so a newer set may appear; re-run the loader if it does.
- The AER gives only a month, so the load takes `--source-date`; the real load used `2021-06-01`. Results show the release text, not that date.
- SHA-256 of the file loaded on 18 Nov 2026: `27500ca9fcf2f022cea4308a9588c62855ba95fdef337afc77184a34fb1e4642`. The workbook is **not** committed; the test fixture is synthetic.

## Workbook layout (checked 18 Nov 2026)

| Sheet | Layout | Rows read |
| --- | --- | --- |
| `Climate zone 1` to `Climate zone 8` | long format, header on row 8: Season, State, Household size, Benchmark (kWh), in columns B to E; the report table to the right is ignored | 20, 40, 20, 60, 60, 60, 80, 80 |
| `SA zones` | header on row 6: South Autralian zones (sic), Household size, then Summer, Autumn, Winter, Spring (kWh) as columns; ten zones x five sizes | 50 rows, 200 values |
| `Postcode mapping` | header on row 6, data from row 7: B postcode, C climate zone (1 to 7); E postcode, F SA zone name | 2,244 and 340 |
| `ACT`, `NSW`, `QLD`, `SA`, `TAS`, `VIC` | long format, header on row 8: Season, Region, Household size, Benchmark (MJ) | 20 each |

Household size is the number 1 to 4 or the text `5+`; we store 5 for `5+`. Zone sheets mix states
(zone 4 has NSW, SA and VIC), so a zone alone is not a key: the state is part of it. Total
740 values (420 electricity by zone, 200 by SA zone, 120 gas) and 2,244 postcodes, of which 340 SA
postcodes also have an SA zone. All SA postcodes with an SA zone are in the climate list too.

Findings from the first check against the real file:

- **Zone 8.** The postcode sheet maps no postcode to zone 8. The zone 8 sheet is identical to
  zone 7 (checked value by value), and the AER says zones 7 and 8 were pooled and share
  benchmarks. We store both sheets as published and never look zone 8 up; postcodes use zone 7.
- **Zones 1 and 3** are also identical (pooled). Zone 1 and 3 each hold QLD only.
- **Gas for ACT and TAS** share figures (pooled); each has its own sheet and we read the sheet for
  the postcode's state.
- **Postcode 2618** straddles the ACT (Hall) and NSW (Murrumbateman). The workbook maps it only to
  zone 6, which has NSW rows and no ACT rows, so it is treated as NSW. It is the only postcode in the file
  whose state, from the standard postcode ranges, is not in its zone's sheet.
- **SA and the climate zone sheets.** SA postcodes also appear in zones 4, 5 and 6. The SA zone
  rows win for SA electricity (see the lookup rule); for the same postcode the two sets differ.

## Storage

Migration `0008-energy-benchmarks` adds, in the `askrighto` schema:

- `energy_benchmarks` (fuel, zone, state, household size 1 to 5, season, value, unit, source sheet), keyed on all five key columns; values keep full precision.
- `energy_benchmark_postcodes` (postcode, climate zone nullable, SA zone nullable).
- `energy_benchmark_load` (file name, SHA-256, release label, source date, git SHA, counts, validation report, time).

It is public reference data, rebuildable from the workbook. Loading replaces everything in one transaction.

```bash
npm run benchmarks:validate -- --file "Simple electricity and gas benchmarks ... postcodes.xlsx"
npm run benchmarks:load -- --file "Simple electricity and gas benchmarks ... postcodes.xlsx" --source-date 2021-06-01
```

`benchmarks:validate` prints rows per sheet and fails on a postcode with no zone, a duplicate key, a
value that is not a positive number, a missing sheet or an incomplete zone (not four seasons by five
sizes). It also reports, without failing, postcodes whose state is not in their zone sheet and
whether zone 8 equals zone 7. `benchmarks:load` runs the same checks, then loads (`DATABASE_URL`
and `DATABASE_SCHEMA` as for the other loaders). Load it only into the local `askrighto_dev` or
the real database on purpose; the tests use `askrighto_test` schemas.

## Lookup rule

`lookupBenchmark(data, { postcode, fuel, householdSize })` in `src/energy/benchmarks/lookup.ts`:

1. The postcode's state comes from the postcode ranges (`state.ts`). WA, NT, anything else, or a postcode the workbook does not list gives `outside_coverage` and no figure. (WA and NT are outside the NEM and the AER regime and out of scope for energy.)
2. **Electricity, SA:** the SA zone for the postcode, rows from `SA zones`. **Electricity elsewhere:** the postcode's climate zone sheet, the rows for the postcode's state.
3. **Gas:** the sheet for the postcode's state.
4. The four seasons are returned as published and the annual figure is their sum. Calendar seasons: Summer is December to February, Autumn March to May, Winter June to August, Spring September to November.

## How `compare_energy_plans` uses it

- Without any usage figure and without `useBenchmarkUsage`, the "needs usage" error stays; it now tells the host it may offer typical usage and ask the household size (1 to 5, 5 meaning five or more).
- With `useBenchmarkUsage: true` and `householdSize`, and no usage figure, it uses the annual benchmark. Without `householdSize` it asks for it. A usage figure, if given, always wins and the benchmark is ignored.
- Bill-only inputs (peak/off-peak shares, controlled load, solar export) cannot be combined with typical usage; the tool asks for the bill instead.
- The result has `usage.basis` (`"customer"` or `"benchmark"`), `usage.benchmark` (zone, state, household size, four seasons, annual, source, release) and `typicalUsageNotice`. The notice leads the markdown text and the Inkview caption, and the result source carries the AER attribution.
- The estimate maths is unchanged; only the label differs.
- **Time-of-use plans** are listed as not estimated (`needs_time_of_use_split`: they need the split from a bill). **Controlled load and solar export** are not computed and the omissions say so.
- Not-covered postcodes return `outside_coverage` and make no estimate. A server with no benchmark load answers `data_unavailable`.

## Limits

- Typical use, not the person's, and a wide spread around it.
- 2020 survey data; mean use and solar uptake have moved since.
- Reweighted to the population's solar and mains-gas mix: not an all-electric or solar home. No adjustment for pools, heating, dwelling type.
- With no time-of-use split, the not-estimated list can be long where time-of-use plans are common.
- Used to estimate cost for a labelled typical household, never to rank "best" or recommend.
