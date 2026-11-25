# Spec Delta

## ADDED Requirements

### Requirement: Side-by-side rates of named plans
`compare_energy_plan_rates` SHALL take a postcode and 2 to 5 plan ids. It SHALL return each plan's published rates, GST inclusive, each band's hours in plain words, controlled load, feed-in, discounts with their conditions, fees, contract length and eligibility, in the order given, each with its plan link, and the result's source link and as-of date.

#### Scenario: Two plans
- **WHEN** two residential electricity plan ids on the same distributor are given
- **THEN** both plans' rates and band hours are returned side by side, with a row for every item even where a plan has none ("not offered")

#### Scenario: Unknown id
- **WHEN** one of the ids is not in the data
- **THEN** the result is a not-found naming that id, and no rates are returned

### Requirement: No totals or ranking without usage
The tool SHALL NOT return or render any yearly cost, total or ordering by price. It SHALL say once that a cost comparison needs usage.

#### Scenario: Rates only
- **WHEN** any result is rendered
- **THEN** it contains no yearly cost and no rank, and it ends with the line saying a cost comparison needs usage

### Requirement: Plans must share a network and fuel
The tool SHALL refuse plans that don't share a fuel and a distributor covering the postcode, naming the mismatch.

#### Scenario: Different distributors
- **WHEN** one plan is for CitiPower and another for Jemena
- **THEN** the result is a needs-input message naming both distributors and asking which is on the user's bill

### Requirement: Current plan marked, not judged
When `currentPlanId` is one of `planIds`, that plan SHALL be labelled the user's current plan. No plan SHALL be marked better or worse.

#### Scenario: Current marked
- **WHEN** `currentPlanId` is given and is in `planIds`
- **THEN** its column is labelled "your current plan", and no recommendation is set in the drawn component
