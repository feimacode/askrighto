# Spec Delta

## ADDED Requirements

### Requirement: Profiles are signed and labelled
A profile built by the server SHALL carry a signature. `compare_energy_plans` SHALL treat a valid signature as verified, and SHALL accept an unsigned or changed profile after the shape and totals checks, labelling the estimate as built by the assistant and not verified.

#### Scenario: Server-built profile
- **WHEN** a profile from `summarise_interval_readings` or the upload endpoint is passed unchanged
- **THEN** the estimate is not labelled unverified

#### Scenario: Changed profile
- **WHEN** a signed profile is edited
- **THEN** the signature fails and the estimate is labelled unverified

#### Scenario: Assistant-built profile
- **WHEN** a profile built by the recipe is passed with no signature
- **THEN** it is accepted if valid and the estimate is labelled unverified

### Requirement: The ladder is in the instructions
The instructions SHALL name the layers in order with the size thresholds and what to do when each fails, and SHALL forbid applying a window the plan does not have.

#### Scenario: Instructions
- **WHEN** the instructions are read
- **THEN** they give paste for a small file, upload for a large one, the recipe if upload fails, and a shorter period or the invoice if none is possible
