# Spec Delta

## ADDED Requirements

### Requirement: A currentPlanId that is not a plan id is refused
`compare_energy_plans` SHALL refuse a `currentPlanId` that is not shaped like a stored plan id (a plan code, `@`, then a distributor code), whatever the usage source, with a message that names the `currentPlanId` field of the option the user picked. It SHALL NOT cost the plan, run the comparison or look for a match by guessing.

#### Scenario: An option number or hash is passed
- **WHEN** `currentPlanId` is `9affe595` or `1` or a plan name
- **THEN** the result is `needs_input`, says it is not a plan id, and says to pass the picked option's `currentPlanId`

#### Scenario: Refused for every usage source
- **WHEN** the usage source is `bill`, `yearly`, `readings` or `typical` and `currentPlanId` is `9affe595`
- **THEN** each is refused in the same way

### Requirement: A plan id that is not in the data says how to carry on
When `currentPlanId` is a well-formed plan id that is not in the data, `compare_energy_plans` SHALL still return the ranking with `current` not costed and reason `not_in_data`, and its detail SHALL say to copy the id from the option the user picked, or to leave it out if the user's plan is no longer offered.

#### Scenario: Retired plan
- **WHEN** `currentPlanId` is `OLD123MR@VEC`, a plan no longer in the data
- **THEN** the ranking is returned, `current` has `costed: false` and `reason: not_in_data`, and the detail carries that advice
