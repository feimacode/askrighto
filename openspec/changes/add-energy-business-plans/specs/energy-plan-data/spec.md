# Spec Delta

## MODIFIED Requirements

### Requirement: Store current plans from the retailers' CDR data
The sync SHALL store current and future-dated residential and business plans, each with its CDR customer type, and SHALL drop a plan whose customer type is missing or neither of those.

#### Scenario: Business plan listed
- **WHEN** a retailer lists a plan whose customer type is business
- **THEN** it is stored with that type

#### Scenario: Other or missing type
- **WHEN** a listed plan has a customer type that is neither residential nor business, or none
- **THEN** it is not stored
