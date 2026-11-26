# Spec Delta

## ADDED Requirements

### Requirement: A bill split is applied exactly only to plans with the same hours
When a peak, shoulder and off-peak split is given with the current plan or its hours layout, `compare_energy_plans` SHALL estimate plans whose band hours equal the current plan's exactly, SHALL label every other time-of-use estimate approximate, and SHALL list the approximate estimates apart from the exact ones.

#### Scenario: Same hours
- **WHEN** a plan has the same band hours as the current plan
- **THEN** the split is applied and the estimate is not labelled approximate

#### Scenario: Different hours
- **WHEN** a plan's band hours differ from the current plan's
- **THEN** it is estimated with the split, labelled "approximate: different hours", and listed in a separate table

#### Scenario: Hours unknown
- **WHEN** no current plan or layout is given with a split
- **THEN** every time-of-use estimate is labelled approximate and the result says the household's own hours are unknown

#### Scenario: Readings given
- **WHEN** interval readings are given
- **THEN** the split and layout are not used and no estimate is labelled approximate for this reason

### Requirement: The agent asks for the invoice first
The instructions SHALL tell the host to ask for the latest invoice before any tool call, to read the listed fields and show them to the user to confirm, to ask the user to pick the customer type, and never to pass an identifier to a tool.

#### Scenario: Instructions
- **WHEN** the instructions are read
- **THEN** they name the fields, the confirmation, the customer type question and the ban on identifiers

#### Scenario: Moving house
- **WHEN** the user is moving house or moving in
- **THEN** the instructions skip the invoice and readings questions and use typical usage for a household
