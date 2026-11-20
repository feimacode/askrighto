# Spec Delta

## ADDED Requirements

### Requirement: The user picks the current plan from a list
The tool SHALL return a short list of the retailer's current plans for the network, postcode and customer type, merged when rates and windows are identical, and SHALL NOT choose a plan for the user from a name.

#### Scenario: Several plans
- **WHEN** a retailer has several current plans on the user's network
- **THEN** the result lists each distinct option with its rates and band hours in plain words and asks the user to pick one or say none of these

### Requirement: Time-range fallback
When the plan is not found or not picked, the tool SHALL list the band-hour layouts the retailer uses on that network.

#### Scenario: Plan not in the data
- **WHEN** the user says none of the listed plans is theirs
- **THEN** the result lists the layouts and the agent asks which matches the bill, or for the hours

### Requirement: Approximate bill splits are labelled
A bill split SHALL be treated as exact only for plans whose band hours equal the current plan's; other plans SHALL be marked approximate.

#### Scenario: Different hours
- **WHEN** a candidate plan's hours differ from the current plan's
- **THEN** its estimate is marked approximate

### Requirement: Personal identifiers stay out
The instructions SHALL tell the agent to send only plan identity and usage figures to Ask Righto tools.

#### Scenario: Bill has a name and account number
- **WHEN** the agent reads a bill
- **THEN** no name, address, account number or NMI is passed to any tool

### Requirement: Moving in skips the bill
The instructions SHALL tell the agent that a household moving house or moving in has no readings, to skip the bill and readings questions, and to use typical usage for households only.

#### Scenario: Moving in
- **WHEN** the user says they are moving in
- **THEN** the agent asks household size and uses labelled typical usage
