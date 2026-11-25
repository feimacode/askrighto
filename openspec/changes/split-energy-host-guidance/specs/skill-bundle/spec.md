# Spec Delta

## ADDED Requirements

### Requirement: One source per journey, served two ways
Each energy journey's guidance SHALL live in one source file. That file SHALL generate the plugin skill and SHALL be returned by `get_energy_guide` for the same journey. The build SHALL fail if a generated skill differs from its source.

#### Scenario: Guide matches skill
- **WHEN** `get_energy_guide` is called with `journey` `energy-readings`
- **THEN** it returns the same steps as the `energy-readings` skill body

#### Scenario: Drift
- **WHEN** a journey source changes and its skill is not regenerated
- **THEN** `guidance:check` fails

### Requirement: Size budgets for always-loaded guidance
Each energy tool description SHALL be at most 500 characters and SHALL hold no workflow steps. The energy server instructions SHALL be at most 1.5 KB. Tests SHALL fail when either limit is exceeded.

#### Scenario: Long description
- **WHEN** a tool description exceeds 500 characters
- **THEN** the budget test fails, naming the tool

### Requirement: Results name the next step
Energy results SHALL carry a short `nextSteps` list when a more accurate usage level or a cost comparison is available, and SHALL NOT carry full recipes.

#### Scenario: Single bill
- **WHEN** an electricity comparison uses a bill with no split
- **THEN** `nextSteps` offers the band split or interval readings
