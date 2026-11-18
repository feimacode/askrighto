# Tasks

## 1. Verify the source

- [ ] 1.1 On the WSL, open `Simple electricity and gas benchmarks ... June 2021 for postcodes 2.xlsx`, record sheets, columns and counts in `docs/energy-benchmarks.md`, and settle where zone 8 postcodes map; verify counts match the validation report
- [ ] 1.2 Record the AER copyright page wording, the workbook's page URL and the attribution text in `docs/data-rights.md`; check the AER site for a newer edition
- [ ] 1.3 Add a small synthetic fixture in the real layout under `test/fixtures/benchmarks/`

## 2. Schema and loader

- [ ] 2.1 Add migration `0008-energy-benchmarks.ts` with `energy_benchmarks`, `energy_benchmark_postcodes`, `energy_benchmark_load` in the `askrighto` schema
- [ ] 2.2 Write the workbook parser (long-format sheets, SA zones, postcode map) keeping values and units as published; verify against the fixture
- [ ] 2.3 Implement `benchmarks:validate` and `benchmarks:load` (single transaction, replace all, file name and hash); verify idempotence and that a failed load keeps old rows
- [ ] 2.4 Implement the lookup (postcode, fuel, size) with the SA zone rule, state selection in shared zone sheets, and `outside_coverage`

## 3. Registry and rights

- [ ] 3.1 Register the dataset with a readiness check and `vertical: energy`
- [ ] 3.2 Add the `aer-benchmarks` entry to `src/core/rights.json` and `docs/data-rights.md`; verify the sync test passes
- [ ] 3.3 Check the AER CC BY 4.0 statement is still current before shipping

## 4. Tool changes

- [ ] 4.1 Add `householdSize` and `useBenchmarkUsage` to `compare_energy_plans` and `Usage.basis`/`benchmark`; verify unit tests for each scenario in the spec
- [ ] 4.2 Add the typical-usage banner and notice to markdown and Inkview output, with source and date; verify a test fails if a benchmark result lacks them
- [ ] 4.3 Update the no-usage error text, the omissions for solar and controlled load, and the TOU not-estimated wording
- [ ] 4.4 Update server instructions and the energy bill skill (ask for a bill first, offer typical usage only if none); verify the smoke test finds the guidance

## 5. Verify with real data

- [ ] 5.1 On the WSL load the real workbook into `askrighto_dev` and `askrighto_test`; verify three postcodes by hand against the workbook (one QLD, one NSW, one SA)
- [ ] 5.2 Run compare_energy_plans for a benchmark case in the three hosts or the MCP Inspector and record that the label shows

## 6. Docs

- [ ] 6.1 Write `docs/energy-benchmarks.md` and `docs/areas/energy.md` updates (what a benchmark is, its limits, the date)
