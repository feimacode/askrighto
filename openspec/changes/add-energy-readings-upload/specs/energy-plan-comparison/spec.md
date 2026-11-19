# Spec Delta

## ADDED Requirements

### Requirement: Usage can come from the person's own interval readings
`compare_energy_plans` SHALL accept the summary of a person's interval readings as usage and cost each plan from it, taking time-of-use bands from the plan's own time windows.

#### Scenario: Time-of-use plan costed from readings
- **WHEN** a summary of readings is given and a plan has complete, non-overlapping time windows
- **THEN** the plan is estimated from the kWh in each window, with daylight saving applied to the plan's local-time windows

#### Scenario: Plan windows incomplete
- **WHEN** a plan's windows leave part of the day uncovered or overlap
- **THEN** the plan is listed as not estimated, with that reason

#### Scenario: Basis shown
- **WHEN** readings were used
- **THEN** the result says "your readings", the date range, the days used and any scaling, and the readings prompt is not shown

#### Scenario: Partial year
- **WHEN** fewer than 300 days or fewer than 9 months are present
- **THEN** the result is labelled partial; under 90 days no yearly estimate is given

#### Scenario: Solar export in the file
- **WHEN** the file has an export register
- **THEN** it is reported as not used and no feed-in credit is worked out
