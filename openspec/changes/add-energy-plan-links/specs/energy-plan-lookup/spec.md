# Spec Delta

## ADDED Requirements

### Requirement: Plans carry a labelled link to their rate sheet or retailer
Each plan result SHALL include a link, built when the result is formed, that is labelled by what it points to and SHALL NOT present a link as the plan's page unless it is one.

#### Scenario: Plan outside Victoria with a postcode
- **WHEN** a plan whose id ends in `@EME` is shown for a postcode
- **THEN** the result links to the Energy Made Easy page for that offer id and postcode, labelled as the rate sheet on Energy Made Easy

#### Scenario: Victorian plan
- **WHEN** a plan whose id ends in `@VEC` is shown
- **THEN** the result links to the retailer's website labelled as the retailer's site, with the note that the rate sheet is found there, and no per-plan link

#### Scenario: Retailer published its own link
- **WHEN** the stored record has a plan link from the retailer
- **THEN** that link is used first

#### Scenario: No link can be built
- **WHEN** there is no postcode for an Energy Made Easy link or no checked website for the brand
- **THEN** the result says no link is available and does not show the plan id as a link

### Requirement: Brand websites are hand-checked and dated
Each active brand SHALL have a checked official website and the date it was checked, or no website and no link.

#### Scenario: Missing website
- **WHEN** an active brand has no website entry
- **THEN** the consistency test fails
