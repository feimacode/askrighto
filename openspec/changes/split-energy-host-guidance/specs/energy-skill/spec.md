# Spec Delta

## ADDED Requirements

### Requirement: Energy guidance is split into journey skills
The plugin SHALL ship five energy skills (`energy-start`, `energy-current-plan`, `energy-readings`, `energy-compare`, `energy-plan-rates`), each covering one journey, and SHALL NOT ship the single `energy-bill-comparison` skill.

#### Scenario: Readings journey
- **WHEN** a user with the plugin says they have an interval readings file
- **THEN** the `energy-readings` skill is loaded, and the others are not needed for that step

#### Scenario: No usage, named plans
- **WHEN** a user asks how two named plans differ and gives no usage
- **THEN** the `energy-plan-rates` skill applies, and `compare_energy_plan_rates` is called
