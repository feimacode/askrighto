# Spec Delta

## ADDED Requirements

### Requirement: Read a NEM12 interval file without keeping it
`summarise_energy_readings` SHALL parse NEM12 text in memory, return only aggregates, and store, log and repeat nothing that identifies the household.

#### Scenario: Sample file shape
- **WHEN** the text has 200, 300 and 400 records, no 100 or 900 record and a short final line
- **THEN** it is read and the summary reports the days covered and the missing days

#### Scenario: Identifiers dropped
- **WHEN** a summary is returned
- **THEN** it contains neither the NMI nor the meter serial, and neither appears in logs

#### Scenario: Gap in the year
- **WHEN** a day has no 300 record
- **THEN** it is listed as missing and not filled in

#### Scenario: Quality flags
- **WHEN** days carry A, V, E, F, S or N flags
- **THEN** the summary counts days and intervals by flag and uses 400 records for V days

#### Scenario: Unusable input
- **WHEN** the text is not NEM12, is over the size cap, or ends mid-record
- **THEN** a plain error says what is wrong and nothing is guessed or truncated

#### Scenario: NEM13
- **WHEN** the text is NEM13 accumulation data
- **THEN** it is refused with a message that it has no time of day and cannot cost time-of-use plans
