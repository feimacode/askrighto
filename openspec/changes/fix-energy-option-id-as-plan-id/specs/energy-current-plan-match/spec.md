# Spec Delta

## ADDED Requirements

### Requirement: Each option gives one id to pass on
Each option in the result of `list_current_plan_options` SHALL carry a `currentPlanId`: the plan id to pass to `compare_energy_plans`, taken from the option's plans. The result SHALL NOT carry any other id for the option as a whole, and SHALL identify the option to the user by its number.

#### Scenario: Option with several plans
- **WHEN** an option groups plans `A@X`, `B@X` and `C@X` with identical rates and hours
- **THEN** the option's `currentPlanId` is one of those plan ids, `planIds` lists them, and the option has no hash or other group id

#### Scenario: Plan code on the invoice
- **WHEN** the invoice's plan code matches a plan in an option
- **THEN** that plan is the option's `currentPlanId`

#### Scenario: Text for the host
- **WHEN** the result is rendered as text
- **THEN** each option is "Option N" and names its `currentPlanId`, and the next step tells the host to pass the chosen option's `currentPlanId` unchanged
