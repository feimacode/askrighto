# Spec Delta

## ADDED Requirements

### Requirement: A stated plan name narrows the pick list
`list_current_plan_options` SHALL accept an optional `planName` that the user states. With no invoice figures, it SHALL return the retailer's options on that network whose names share words with it, as a list for the user to pick from. It SHALL NOT select a plan by name alone.

#### Scenario: Name without an invoice
- **WHEN** the user gives the retailer and a plan name but no invoice figures
- **THEN** the options whose names share words with it are listed for the user to pick, each with its rates and band hours

#### Scenario: No name match
- **WHEN** no option's name shares a word with `planName`
- **THEN** the result says so and offers the band-hour layouts to pick from, as the existing fallback does
