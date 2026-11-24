# Spec Delta

## ADDED Requirements

### Requirement: The usage input names its source
`compare_energy_plans` SHALL take a required `usageSource` of `readings`, `assistant_readings`, `bill`, `yearly` or `typical`. It SHALL use only the fields that belong to that source, and SHALL read `usage` in kWh for electricity and MJ for gas.

#### Scenario: Bill
- **WHEN** `usageSource` is `bill` with `usage` 900 and `usageDays` 90 for electricity
- **THEN** usage is 900 kWh scaled to a year (x 365/90), and the result says it was scaled from one bill

#### Scenario: Gas bill
- **WHEN** `fuelType` is GAS and `usageSource` is `bill` with `usage` 5000 and `usageDays` 60
- **THEN** usage is 5000 MJ scaled to a year

#### Scenario: Typical
- **WHEN** `usageSource` is `typical` with `householdSize` 2 for a residential customer
- **THEN** the AER benchmark for the postcode's zone is used and the result is labelled typical usage, not the household's own

#### Scenario: Missing field for the source
- **WHEN** `usageSource` is `bill` and `usageDays` is missing
- **THEN** the result is a needs-input message naming `usageDays`

### Requirement: Fields outside the source are refused, not dropped
A field that doesn't belong to the chosen `usageSource`, or doesn't apply to the fuel, SHALL be refused with a message that names the field and the source. The one exception: `currentPlanId` or `hoursLayoutId` with `bill` or `yearly` and no split SHALL be kept and reported as a warning.

#### Scenario: Split with typical usage
- **WHEN** `usageSource` is `typical` and `peakSharePct` is given
- **THEN** the result is a needs-input message naming `peakSharePct` and `typical`

#### Scenario: Readings for gas
- **WHEN** `fuelType` is GAS and `usageSource` is `readings`
- **THEN** the result is a needs-input message saying readings apply to electricity only

#### Scenario: Bill figure sent with readings
- **WHEN** `usageSource` is `readings` and `usage` is also given
- **THEN** the result is a needs-input message naming `usage`, and no estimate is made

#### Scenario: Current plan without a split
- **WHEN** `usageSource` is `bill` with `currentPlanId` and no split
- **THEN** the comparison runs, and `warnings` says the current plan's hours were not needed without a split

### Requirement: Readings summed by the assistant are their own level
`usageSource: assistant_readings` SHALL require `usage`, `usageDays`, a band split and `currentPlanId` or `hoursLayoutId`. The result SHALL be labelled as the household's own readings, summed by the assistant and not verified by Ask Righto.

#### Scenario: Assistant-summed readings
- **WHEN** `usageSource` is `assistant_readings` with 4,100 kWh over 365 days, a split and `currentPlanId`
- **THEN** plans with the current plan's hours are estimated exactly, others are labelled approximate, and the result leads with the not-verified label

#### Scenario: Hours missing
- **WHEN** `usageSource` is `assistant_readings` without `currentPlanId` or `hoursLayoutId`
- **THEN** the result is a needs-input message saying which hours the readings were banded by is needed

### Requirement: Customer type is required
`compare_energy_plans` SHALL require `customerType` and SHALL NOT default it.

#### Scenario: Missing customer type
- **WHEN** a call omits `customerType`
- **THEN** the input is rejected by the schema

### Requirement: The result states its usage level
Every comparison result SHALL carry `usage.level` and a one-sentence `usage.accuracy`. The text output SHALL show the accuracy sentence before any figure.

#### Scenario: Level shown
- **WHEN** any comparison succeeds
- **THEN** `usage.level` equals the source used and the text begins with the accuracy sentence

