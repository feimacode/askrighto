# Spec Delta

## ADDED Requirements

### Requirement: Results prompt people to request interval readings
When a comparison's usage is a benchmark or taken from a single bill, the result SHALL include one short note that the person can ask their retailer or their distributor for interval readings, which give a more accurate comparison, and what they will need.

#### Scenario: Benchmark usage
- **WHEN** `compare_energy_plans` returns estimates using benchmark usage
- **THEN** the result includes the readings note once, below the plan table, in both markdown and Inkview output

#### Scenario: Single-bill usage
- **WHEN** usage was scaled from one bill
- **THEN** the same note is included

#### Scenario: Usage already from readings
- **WHEN** the person's usage is not a benchmark or a single bill
- **THEN** no readings note is shown

### Requirement: The note links the distributor's own request page when known
Where the distributor is known and has a checked entry, the note SHALL link that distributor's own meter data request page and show the check date in the docs; otherwise it SHALL stay generic with no link.

#### Scenario: Known distributor
- **WHEN** the distributor matches an entry in `distributors.json`
- **THEN** the note links that entry's request page

#### Scenario: Unmatched distributor
- **WHEN** the distributor name matches no entry or alias
- **THEN** the note is shown without a link and with no claim about that distributor's process

#### Scenario: Consistency
- **WHEN** the consistency test runs against distributors named on active plans
- **THEN** it fails if one has neither an entry nor an explicit "none" marker

### Requirement: Time-of-use plans explain what is missing
A time-of-use plan listed as not estimated for needing a usage split SHALL say that interval readings would allow it to be compared.

#### Scenario: Time-of-use plan under benchmark usage
- **WHEN** a time-of-use plan is not estimated because there is no peak, shoulder and off-peak split
- **THEN** its entry says interval readings from the retailer or distributor would allow a comparison

### Requirement: The note makes no claim beyond what is checked
The note SHALL NOT state fees or times for a distributor unless that distributor's page does, SHALL NOT imply Ask Righto requests, receives or reads the readings, and SHALL use "usually" or "about" for any time or cost.

#### Scenario: Wording check
- **WHEN** the output tests run
- **THEN** they fail if the note promises a fee, a time or Ask Righto handling the data without a source
