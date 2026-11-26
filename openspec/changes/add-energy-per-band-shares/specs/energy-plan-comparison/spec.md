# Spec Delta

## ADDED Requirements

### Requirement: Usage shares are per band
`compare_energy_plans` SHALL work out the share of use in each of a time-of-use plan's own bands, and SHALL cost the plan with those shares.

#### Scenario: Readings and several shoulder bands
- **WHEN** a plan has two shoulder bands and the usage comes from interval readings
- **THEN** each shoulder band gets its own share from the readings and the plan is estimated

#### Scenario: Bill split and several shoulder bands
- **WHEN** a plan has two shoulder bands and the usage comes from a peak, shoulder and off-peak split
- **THEN** the shoulder share is split equally between them and the estimate says so

#### Scenario: Single shoulder band unchanged
- **WHEN** a plan has one shoulder band
- **THEN** its estimate equals the estimate made before this change for the same inputs

#### Scenario: No shoulder band
- **WHEN** a plan has no shoulder band
- **THEN** the shoulder share is charged at the peak rate, as before, and the estimate says so
