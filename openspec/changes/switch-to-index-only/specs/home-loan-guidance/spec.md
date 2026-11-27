# Spec Delta

## Purpose
Guide an agent to read home loan product data from lenders' CDR endpoints, with nothing stored.

## ADDED Requirements

### Requirement: CDR banking guide
The system SHALL provide `get_cdr_banking_guide` returning, per journey, the CDR Register link, the lender index, endpoint paths, version headers, object structure, known quirks and wording rules.

#### Scenario: Find journey
- **WHEN** a caller asks for the find journey
- **THEN** the result lists lenders with their base URIs and the product list path and says each rate must be quoted with lender, link and time fetched

### Requirement: No product data stored
The system SHALL NOT sync or store lender product data or the RBA cash rate.

#### Scenario: Server start
- **WHEN** the `home-loans` vertical starts
- **THEN** it opens no product tables and runs no sync

### Requirement: Wording
The guide SHALL forbid ranking, "best" or "recommended", and SHALL describe a comparison rate as a figure for a stated example loan.

#### Scenario: Comparison request
- **WHEN** a user asks which loan is best
- **THEN** the skill says Ask Righto gives general information only and shows the read figures side by side

## REMOVED Requirements

### Requirement: Home loan search, get, compare and reference rate tools
**Reason**: They depended on stored CDR data.
