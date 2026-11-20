# Spec Delta

## ADDED Requirements

### Requirement: Business plans are stored beside residential plans
The sync SHALL store plans whose CDR customer type is RESIDENTIAL or BUSINESS and SHALL skip plans with another or no customer type.

#### Scenario: Business plan listed
- **WHEN** a retailer lists a plan with customer type BUSINESS
- **THEN** it is stored with customer type BUSINESS

### Requirement: Results never mix customer types
Plan lookups SHALL return plans of one customer type, RESIDENTIAL unless BUSINESS is asked for.

#### Scenario: Default lookup
- **WHEN** a postcode search names no customer type
- **THEN** only residential plans are returned

#### Scenario: Business has no typical usage
- **WHEN** a comparison for BUSINESS is requested with no usage figures
- **THEN** the tool asks for a bill or interval readings and offers no typical usage

### Requirement: Large customers are not compared
The agent instructions SHALL tell the agent that large customers are outside what Ask Righto compares.

#### Scenario: Large business
- **WHEN** the user says the business is a large customer
- **THEN** the agent says it cannot compare large-customer plans and does not run a comparison
