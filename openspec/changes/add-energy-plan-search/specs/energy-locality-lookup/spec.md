# Spec Delta

## ADDED Requirements

### Requirement: Suburb to postcode lookup
`find_postcodes` SHALL take a place name and an optional state and return the postcodes of matching suburbs or localities from open data, with the dataset's source, licence and release date. It SHALL NOT guess: several states or several equal matches SHALL return candidates for the host to put to the user.

#### Scenario: Unique suburb
- **WHEN** the place is "Box Hill" and the state is VIC
- **THEN** the result lists the postcode or postcodes of Box Hill in Victoria, with the source and release date

#### Scenario: Same name in two states
- **WHEN** the place is "Box Hill" and no state is given and the name exists in two states
- **THEN** the result is a needs-input listing each state with its postcodes

#### Scenario: Suburb in two postcodes
- **WHEN** a suburb spans more than one postcode
- **THEN** all its postcodes are listed, most of the suburb first, and the result says to ask the user which applies

#### Scenario: Not found
- **WHEN** no suburb matches
- **THEN** the result is a not-found and asks the user for a postcode

### Requirement: Out-of-scope states are named
When every postcode of a match lies in WA or NT, the result SHALL say energy plans are outside this service's coverage.

#### Scenario: Perth suburb
- **WHEN** the place is a WA suburb
- **THEN** the result says WA is not covered and gives no plan advice

### Requirement: Rebuildable reference data
The locality table SHALL be loaded from the published source by a command, hold no user data, and be rebuildable from that source.

#### Scenario: Reload
- **WHEN** the load command is run twice on the same file
- **THEN** the table holds the same rows and the dataset release date is unchanged

### Requirement: Place name only
The tool SHALL accept a place name and state only, and SHALL NOT accept or store a street address.

#### Scenario: Address typed
- **WHEN** the place text contains a street number
- **THEN** the result asks for the suburb only and looks nothing up
