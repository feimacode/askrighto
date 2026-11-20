# Spec Delta

## Purpose

Helps a person identify their current plan's band hours from a short list, without matching on name.

## ADDED Requirements

### Requirement: A short pick list of current plan options
`list_current_plan_options` SHALL return, for a retailer, network, fuel and customer type, a short list of distinct options with plain-words rates and band hours, merging plans with identical rates and hours, and SHALL include a "none of these" route.

#### Scenario: Several plans with the same rates and hours
- **WHEN** several plan ids share rates and hours
- **THEN** they appear as one option listing up to three of the plan ids

#### Scenario: Invoice rates given
- **WHEN** supply charge or rates from the invoice are given
- **THEN** options are ranked by agreement with them, allowing the rates to include or exclude GST, and each option says what matched

#### Scenario: Customer type
- **WHEN** a customer type is given
- **THEN** only plans of that type are listed

### Requirement: Fallback by band hours
When the plan is not listed or the user cannot choose, the tool SHALL list the band-hour layouts that retailer uses on that network, each with an id, in plain words.

#### Scenario: Plan not in the data
- **WHEN** the user chooses none of the options
- **THEN** the tool returns the retailer's layouts for that network to pick from

### Requirement: Nothing personal is taken or kept
The tool SHALL accept no name, address, account number or NMI and SHALL store nothing.

#### Scenario: Inputs
- **WHEN** the tool's inputs are listed
- **THEN** they contain only postcode, fuel, customer type, retailer, network, rate figures and a GST flag
