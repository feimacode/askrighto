# Spec Delta

## Purpose
Relay lenders' CDR home loan product data live, with nothing stored.

## ADDED Requirements

### Requirement: List lenders
The system SHALL provide `list_home_loan_lenders` returning banking brands from the CDR Register with their public base URIs, filtered by a name fragment.

#### Scenario: Name filter
- **WHEN** a caller gives a name fragment
- **THEN** only matching brands are returned, each with its brand id

### Requirement: Fetch lender products
The system SHALL provide `get_home_loan_products` returning one lender's residential mortgage list or one product's detail, fetched live with the right `x-v` header and returned as the lender sent it, with the lender URL, version used and fetch time.

#### Scenario: Older version rejected
- **WHEN** a lender answers 406 to the first version tried
- **THEN** the next version is tried and the version that worked is reported

#### Scenario: Ambiguous lender
- **WHEN** a name matches several brands
- **THEN** the result is `needs_input` with the candidates and calls no lender

### Requirement: Fixed request shape
The system SHALL send a lender only the two CDR product paths on a Register base URI and SHALL NOT forward caller headers or accept a caller URL.

#### Scenario: Unsafe base URI
- **WHEN** a Register base URI is not https, has credentials or a port, or is an IP address
- **THEN** it is not used

### Requirement: Nothing stored
The system SHALL NOT write lender response data to the database, disk or logs, and SHALL NOT cache it beyond the request; only the Register brand list is held in memory.

#### Scenario: Repeat request
- **WHEN** the same product is requested twice
- **THEN** the lender is asked twice
