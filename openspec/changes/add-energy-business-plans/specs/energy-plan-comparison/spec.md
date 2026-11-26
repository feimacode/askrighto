# Spec Delta

## ADDED Requirements

### Requirement: Plans are compared within one customer type
`search_energy_plans` and `compare_energy_plans` SHALL take a customer type (residential by default, or business), SHALL return only plans of that type, and SHALL state which type the result covers.

#### Scenario: Household
- **WHEN** no customer type or residential is given
- **THEN** only residential plans are returned and the result says residential

#### Scenario: Business
- **WHEN** business is given
- **THEN** only business plans are returned and the result says business

### Requirement: A business has no typical usage
The tool SHALL refuse the typical-usage option for a business and SHALL ask for a bill or interval readings.

#### Scenario: Business asks for typical usage
- **WHEN** business and typical usage are both given
- **THEN** the tool returns an input error asking for a bill or readings and makes no estimate
