# Spec Delta

## Purpose

Holds the state government energy concession rules for the states the energy data covers, with their official source and as-of date, so a comparison can show what a concession holder would pay without the model inventing a concession amount.

## ADDED Requirements

### Requirement: Concession rules come from official pages
Each concession rule SHALL carry the state, the fuel, the eligibility in plain words, the calculation (fixed yearly amount, daily amount, or percentage with any stated limit), the official page link and the date it was checked. A rule SHALL hold only what the official page states.

#### Scenario: Rule shown with its source
- **WHEN** a comparison uses a concession rule
- **THEN** the result gives the rule's official link and its checked date

#### Scenario: State without a held rule
- **WHEN** a person in a covered state says they hold a concession card and no rule is held for that state and fuel
- **THEN** no concession figure is shown, the result says the concession was not estimated and gives the state's official concessions link

### Requirement: Stale rules are not used
A rule whose checked date is before the start of the current Australian financial year SHALL NOT be applied; the result SHALL give its official link and say it is being re-checked.

#### Scenario: Rule not re-checked after 1 July
- **WHEN** a comparison runs on 10 July and the state's rule was last checked in May
- **THEN** no concession figure is shown and the official link is given

### Requirement: Concession estimates are deterministic
The concession estimate for a plan SHALL be computed from the plan's estimated yearly cost and the rule alone, and SHALL be shown as its own figure, never merged into the plan's cost before concession.

#### Scenario: Fixed yearly concession
- **WHEN** the rule is a fixed yearly amount and the plan's estimate is above it
- **THEN** the cost after concession is the estimate less that amount

#### Scenario: Concession larger than the bill
- **WHEN** the rule's amount exceeds the plan's estimate
- **THEN** the cost after concession is not below zero and the result says so
