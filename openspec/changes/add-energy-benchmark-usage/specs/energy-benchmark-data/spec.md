# Spec Delta

## Purpose

Holds the AER's published typical household electricity and gas use, keyed by place, household size and season, with its source and release date, so a labelled typical-usage estimate can be made without a bill.

## ADDED Requirements

### Requirement: Benchmarks are loaded unchanged from the AER workbook
The loader SHALL store each benchmark value, unit, season, state, climate zone and household size exactly as the AER workbook states them, and the postcode-to-zone mapping exactly as listed, replacing the previous set in one transaction.

#### Scenario: Successful load
- **WHEN** the loader runs on the workbook
- **THEN** all electricity and gas rows and all postcode mappings are stored together with the file name, its hash and the load time

#### Scenario: Failed load keeps old data
- **WHEN** parsing or validation fails part-way
- **THEN** the previously loaded benchmarks remain unchanged

#### Scenario: Validation report
- **WHEN** `benchmarks:validate` runs
- **THEN** it reports row counts per sheet, any postcode with no zone, duplicate keys and any value that is not a positive number, and fails if any exist

### Requirement: Look up a benchmark for a postcode
A lookup SHALL take a postcode, a fuel and a household size and return the four seasonal values, their sum, the unit, the climate zone or SA zone, the source URL, the release date and the attribution, or an explicit not-found.

#### Scenario: Electricity in a covered postcode
- **WHEN** the lookup is called for a covered postcode, electricity and size 2
- **THEN** it returns four seasonal kWh values and their annual sum with source and date

#### Scenario: Zone sheet shared by states
- **WHEN** the postcode's state appears in the zone sheet with several states
- **THEN** the row for that postcode's state is used

#### Scenario: South Australia
- **WHEN** the postcode is in South Australia
- **THEN** electricity uses the South Australian zone benchmarks

#### Scenario: Not covered
- **WHEN** the postcode has no mapping in the workbook (WA and NT are out of scope for energy)
- **THEN** the lookup returns `outside_coverage` and no figure

#### Scenario: Pooled cells
- **WHEN** the AER pooled household sizes so two sizes have the same value
- **THEN** the value is returned as published, and no adjustment is made

### Requirement: Source, licence and as-of date are recorded
The dataset SHALL be registered with its AER source, CC BY 4.0 basis, attribution wording and release date, and results using it SHALL carry them.

#### Scenario: Rights entry present
- **WHEN** the rights consistency test runs
- **THEN** it finds an `aer-benchmarks` entry in `src/core/rights.json` matching `docs/data-rights.md`
