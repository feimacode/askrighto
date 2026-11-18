# Tasks

## 1. Verify the source

- [x] 1.1 On the WSL, open `Simple electricity and gas benchmarks ... June 2021 for postcodes 2.xlsx`, record sheets, columns and counts in `docs/energy-benchmarks.md`, and settle where zone 8 postcodes map; verify counts match the validation report
  - Done 18 Nov 2026 on the real workbook (downloaded from the AER page; SHA-256 in `docs/energy-benchmarks.md`). Counts match: 740 values, 2,244 + 340 postcodes. Zone 8 equals zone 7 and no postcode maps to it. Findings in `docs/energy-benchmarks.md`.
- [x] 1.2 Record the AER copyright page wording, the workbook's page URL and the attribution text in `docs/data-rights.md`; check the AER site for a newer edition
  - Done. AER copyright page wording, workbook page URL and attribution are in `docs/data-rights.md` and `src/core/rights.json`; no newer edition found on 18 Nov 2026.
- [x] 1.3 Add a small synthetic fixture in the real layout under `test/fixtures/benchmarks/`
  - Done: `test/fixtures/benchmarks/aer_benchmarks_synthetic.xlsx` (invented numbers, real layout) and its generator `make-fixture.mjs`.

## 2. Schema and loader

- [x] 2.1 Add migration `0008-energy-benchmarks.ts` with `energy_benchmarks`, `energy_benchmark_postcodes`, `energy_benchmark_load` in the `askrighto` schema
  - Done: `src/energy/migrations/0008-energy-benchmarks.ts`, registered in `db.ts`.
- [x] 2.2 Write the workbook parser (long-format sheets, SA zones, postcode map) keeping values and units as published; verify against the fixture
  - Done: `src/energy/benchmarks/parse.ts`, verified against the fixture and the real file.
- [x] 2.3 Implement `benchmarks:validate` and `benchmarks:load` (single transaction, replace all, file name and hash); verify idempotence and that a failed load keeps old rows
  - Done: `benchmarks:validate` and `benchmarks:load` (`src/energy/benchmarks/cli.ts`, `load.ts`). Tests: load twice keeps 740 rows, a failed load keeps the old rows, an empty load is refused.
- [x] 2.4 Implement the lookup (postcode, fuel, size) with the SA zone rule, state selection in shared zone sheets, and `outside_coverage`
  - Done: `src/energy/benchmarks/lookup.ts` and `state.ts`. Postcode 2618 is treated as NSW (the workbook maps it only to a zone with NSW rows).

## 3. Registry and rights

- [x] 3.1 Register the dataset with a readiness check and `vertical: energy`
  - Done, with one difference: the readiness check `energy-benchmarks` fails only if the schema is behind or the database is unreachable. A missing load is not 'not ready', because bill-based comparison needs no benchmark; the dataset listing and the tool say it is not loaded. Dataset `aer-benchmarks` (vertical `energy`, max age ten years: a fixed reference set).
- [x] 3.2 Add the `aer-benchmarks` entry to `src/core/rights.json` and `docs/data-rights.md`; verify the sync test passes
  - Done; `test/data-rights.test.ts` passes.
- [x] 3.3 Check the AER CC BY 4.0 statement is still current before shipping
  - Done 18 Nov 2026: the AER page still states CC BY 4.0 with exceptions for the Coat of Arms, logos, third-party content and material marked otherwise. Re-check before shipping.

## 4. Tool changes

- [x] 4.1 Add `householdSize` and `useBenchmarkUsage` to `compare_energy_plans` and `Usage.basis`/`benchmark`; verify unit tests for each scenario in the spec
  - Done: `householdSize`, `useBenchmarkUsage`, `Usage.basis` (optional in the type, defaults to customer) and `usage.benchmark`. Tests in `test/energy/benchmarks.test.ts` cover each spec scenario.
- [x] 4.2 Add the typical-usage banner and notice to markdown and Inkview output, with source and date; verify a test fails if a benchmark result lacks them
  - Done: `typicalUsageNotice` leads the markdown and the Inkview caption; the source line and attribution carry the AER source. Tests assert the notice precedes the table and that 'your usage' / 'your bill' never appear.
- [x] 4.3 Update the no-usage error text, the omissions for solar and controlled load, and the TOU not-estimated wording
  - Done: new no-usage error text, omissions for solar and controlled load, and the time-of-use detail 'needs the peak, shoulder and off-peak split from a bill' for benchmark usage.
- [x] 4.4 Update server instructions and the energy bill skill (ask for a bill first, offer typical usage only if none); verify the smoke test finds the guidance
  - Done: `src/energy/instructions.ts` and `plugin/skills/energy-bill-comparison`; a test checks the server instructions.

## 5. Verify with real data

- [x] 5.1 On the WSL load the real workbook into `askrighto_dev` and `askrighto_test`; verify three postcodes by hand against the workbook (one QLD, one NSW, one SA)
  - Done on the WSL: real workbook loaded into `askrighto_dev` (twice, 740 + 2,244 rows each time). Hand-checked against the workbook cells: QLD 4000 size 2 (zone 2, 5,126.39 kWh), NSW 2000 size 3 (zone 5, 6,361.71 kWh), SA 5000 size 2 (Adelaide & Environs, 5,046.02 kWh); VIC 3000 gas size 2 also matched (50,462.19 MJ). Not loaded into `askrighto_test`: its tests use throwaway schemas and the synthetic fixture.
- [x] 5.2 Run compare_energy_plans for a benchmark case in the three hosts or the MCP Inspector and record that the label shows
  - Done over the in-memory MCP transport with the real workbook in a throwaway test schema and fixture plans (`askrighto_dev` holds no plans). The typical-usage line leads the output with the source and release. Not run in the three hosts or the MCP Inspector.

## 6. Docs

- [x] 6.1 Write `docs/energy-benchmarks.md` and `docs/areas/energy.md` updates (what a benchmark is, its limits, the date)
  - Done: `docs/energy-benchmarks.md`, `docs/areas/energy-plans.md`, `docs/energy-estimates.md`.
