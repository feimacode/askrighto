# Spec Delta

## Purpose

Reads a household's own NEM12 interval readings, supplied in the request, into a compact profile without storing the file or any identifier.

## ADDED Requirements

### Requirement: A NEM12 file is read into an identifier-free profile
The `summarise_interval_readings` tool SHALL parse the text of a NEM12 file in memory and return the period covered, the days present and missing, total kWh, the registers found, a count of non-actual quality flags and outage events, and a profile string, and SHALL NOT return, log or store the NMI, the meter serial or any per-day value.

#### Scenario: Real export without header or end record
- **WHEN** the file has `200`, `300` and `400` records but no `100` or `900` record, and the last line lacks its trailing field
- **THEN** the tool reads it, returns the period, days present, missing dates and total kWh, and no identifier

#### Scenario: Missing day
- **WHEN** a date inside the period has no `300` record
- **THEN** the date is listed as missing and the annual figure is scaled by days present, with that stated

#### Scenario: Variable day with events
- **WHEN** a `300` record has quality `V` and `400` records follow
- **THEN** the intervals marked as outage are counted and reported, and the figures are used as stated

#### Scenario: Finer intervals
- **WHEN** the file has 5 or 15 minute intervals
- **THEN** they are summed to 30 minutes before the profile is built

### Requirement: Files that cannot give correct figures are refused
The tool SHALL refuse a file that is not NEM12, has no consumption register, holds more than one NMI, has a non-numeric or misshapen interval line, or exceeds the size cap, and SHALL give no figures.

#### Scenario: Accumulation file
- **WHEN** the file has `250` records (NEM13)
- **THEN** the tool says it is an accumulation file with no half-hourly figures and asks for interval data

#### Scenario: Several NMIs
- **WHEN** the file holds more than one NMI
- **THEN** the tool refuses and asks for one household's file

#### Scenario: Not a number
- **WHEN** an interval value is not numeric
- **THEN** the tool names the line number and the problem, never the line content

### Requirement: Nothing is kept
The server SHALL NOT store the file, the profile or any derived value, and SHALL NOT include the input text in any log.

#### Scenario: Error path
- **WHEN** parsing fails part-way
- **THEN** only the error message is logged and no part of the input is recorded

### Requirement: Source and period travel with the result
Every result SHALL name its source as the household's own readings, with the first and last interval date as the as-of range, and SHALL label them as the person's, not typical.

#### Scenario: Result wording
- **WHEN** the tool returns a profile
- **THEN** the text says the figures are from the household's own interval readings for that period
