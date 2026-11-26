# Spec Delta

## ADDED Requirements

### Requirement: The current plan is costed as a baseline
When `currentPlanId` is given, `compare_energy_plans` SHALL cost that plan on the same usage and with the same rules as the candidates. It SHALL return the result in `current`, with its source link and as-of date, and SHALL NOT rank it among the candidates.

#### Scenario: Baseline costed
- **WHEN** a bill comparison is given `currentPlanId` of a stored plan on the same distributor
- **THEN** `current` holds that plan's yearly estimate and breakdown, and the plan is not in `estimates`

#### Scenario: No baseline
- **WHEN** `usageSource` is `typical` and the current plan is time-of-use
- **THEN** `current` says it was not costed and why, the ranking is returned, and no differences are shown

#### Scenario: Plan not in the data
- **WHEN** `currentPlanId` is not found
- **THEN** `current` says the plan is not in the current published data, and the ranking is returned without differences

### Requirement: Each estimate shows its difference from the current plan
With a costed baseline, each estimate SHALL carry `differenceFromCurrentCents` (no conditions met on either side). Each row of the conditions table SHALL carry `differenceIfConditionsMetCents` (conditions met on both sides). The summary SHALL say how many plans have a lower estimate than the current plan.

#### Scenario: Differences shown
- **WHEN** the baseline is $1,800 and a plan's estimate is $1,650
- **THEN** that plan's difference is -$150, and the summary counts it as a lower estimate

#### Scenario: Approximate row
- **WHEN** a plan's estimate is approximate because its hours differ
- **THEN** its difference is also labelled approximate

### Requirement: Neutral wording about the current plan
Result text SHALL describe differences as "lower" or "higher estimate than your current plan for the usage given" and SHALL NOT use "save", "better", "switch" or "recommended".

#### Scenario: Wording check
- **WHEN** any result with a baseline is rendered
- **THEN** none of the banned words appear in it
