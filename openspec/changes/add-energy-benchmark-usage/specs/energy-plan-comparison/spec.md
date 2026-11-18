# Spec Delta

## MODIFIED Requirements

### Requirement: Compare plans for stated usage
The `compare_energy_plans` tool SHALL take a postcode, a fuel type and either the person's usage or an explicit request for typical usage with a household size, and SHALL return an estimated yearly cost for each available plan it can estimate.

#### Scenario: Usage given from a bill
- **WHEN** the tool is called with the kWh and the number of days from one bill
- **THEN** it scales that usage to a year, states that it did so, returns the estimates and marks the usage basis as the person's own

#### Scenario: No usage given and no benchmark requested
- **WHEN** the tool is called without any usage figure and without `useBenchmarkUsage`
- **THEN** it returns an input error telling the host to ask for the kWh and days on a recent bill, to offer typical usage with a household size if there is no bill, and makes no estimate

## ADDED Requirements

### Requirement: Benchmark usage is opt-in and labelled
When no usage figure is given and `useBenchmarkUsage` is true with a `householdSize`, the tool SHALL use the AER benchmark annual figure for that postcode, fuel and size, SHALL mark the result's usage basis as benchmark, and SHALL show the zone, household size, seasonal values, source, release date and a notice that this is typical usage, not the person's own.

#### Scenario: Benchmark electricity estimate
- **WHEN** the tool is called with a covered postcode, electricity, `useBenchmarkUsage` true and `householdSize` 3
- **THEN** the estimates use the benchmark annual kWh, the result states "typical usage for a household of 3 in this zone, not your own" and carries the AER source and date

#### Scenario: Benchmark requested without household size
- **WHEN** `useBenchmarkUsage` is true and no household size is given
- **THEN** the tool returns an input error asking for the household size and makes no estimate

#### Scenario: Stated usage wins
- **WHEN** both a usage figure and `useBenchmarkUsage` are given
- **THEN** the person's own usage is used, the basis is the person's own, and the benchmark is not applied

#### Scenario: Not covered
- **WHEN** the postcode is outside the benchmark data
- **THEN** the tool returns `outside_coverage` for the benchmark and makes no estimate

### Requirement: Benchmark usage never fills gaps it cannot support
With benchmark usage the tool SHALL list time-of-use plans as not estimated for needing a time-of-use split, SHALL NOT compute a solar feed-in credit or controlled load charge from benchmarks, and SHALL list these as omissions.

#### Scenario: Time-of-use plan
- **WHEN** a time-of-use plan is compared using benchmark usage
- **THEN** it appears in the not-estimated list with the reason that it needs the peak, shoulder and off-peak split from a bill

#### Scenario: Solar and controlled load
- **WHEN** benchmark usage is used
- **THEN** the omissions say that solar export and controlled load are not included

### Requirement: Benchmark estimates are never presented as the person's cost
Every output form of a benchmark-based estimate SHALL show the typical-usage notice before the figures, and SHALL NOT use the words "your usage" or "your bill" for the benchmark figure.

#### Scenario: Text-only host
- **WHEN** the result is rendered as markdown
- **THEN** the typical-usage line appears above the table
