# Spec Delta

## Purpose

Guides a host model through the energy comparison intake and answer, so costs are compared on the user's real usage and nothing is assumed.

## ADDED Requirements

### Requirement: Intake before comparison
The skill SHALL tell the host to collect postcode, distributor (when more than one applies), usage and billing days from a recent bill, and, where relevant, the time-of-use split, solar and controlled load, before calling the compare tool.

#### Scenario: Usage not given
- **WHEN** the user asks for the cheapest plan without usage
- **THEN** the host asks for kWh and days from a bill and does not call the compare tool with assumed usage

#### Scenario: Several distributors
- **WHEN** the postcode search returns more than one distributor
- **THEN** the host asks which is on the bill

### Requirement: Neutral wording of results
The skill SHALL tell the host to call results the lowest estimate for the usage given, to pass on assumptions, discount conditions and the tool's notice, and never to say best or recommended.

#### Scenario: Plan not estimated
- **WHEN** the tool lists a plan as not estimated
- **THEN** the host says why, links the plan, and gives no cost

### Requirement: No unsourced figures in skill files
Skill files SHALL contain no real prices, plan names or retailer claims, and examples SHALL be labelled as invented.

#### Scenario: Content scan
- **WHEN** tests scan the skill files
- **THEN** the worked example is labelled invented and no currency amount is presented as real
