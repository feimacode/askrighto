# Spec Delta

## Purpose

Defines how the home loan vertical is measured for data coverage, data accuracy, calculator correctness and assistant behaviour before any public listing.

## ADDED Requirements

### Requirement: Coverage report reads only our data
The system SHALL provide `report:homeloans` printing lenders listed, answering and failing, products stored, shares understood, tailored, with comparison rate, with LVR tiers, with readable fixed terms and with fees, verified age and rights status, and SHALL write nothing to the database.

#### Scenario: Dataset pending
- **WHEN** a home loan dataset has rights status `pending`
- **THEN** the report fails with a message naming the dataset

### Requirement: Accuracy spot check against lender pages
Before promotion the project SHALL record a spot check of at least 30 products against the lenders' own pages, read by a person or the user's browsing assistant and never fetched by the server, with each row classed as match or one of the named mismatch classes.

#### Scenario: Bot check
- **WHEN** a lender page cannot be read without passing a bot check
- **THEN** the row is recorded `not_checkable` and the check is not bypassed

### Requirement: Calculator verified independently
`calculate_home_loan_repayments` SHALL be checked against at least three independently sourced worked examples and SHALL match each payment within one cent.

#### Scenario: Mismatch
- **WHEN** a result differs by more than one cent
- **THEN** the check fails and records the example's source

### Requirement: Fixed prompt set including adversarial prompts
The project SHALL keep a versioned prompt set of 24 questions covering factual, edge and adversarial cases, each with expected tools and a "must" statement, and SHALL run the adversarial prompts three times per host.

#### Scenario: Tool name drift
- **WHEN** a prompt names a tool that is not registered
- **THEN** a test fails

### Requirement: Scorecard records behaviour
The scorecard SHALL record per prompt and host the tools called, figures traced to tool results, banned wording seen, notices present, refusal correctness and completeness.

#### Scenario: Banned wording seen
- **WHEN** an answer contains "best" or "you should" about a loan
- **THEN** the row is marked failed and the quote is recorded

### Requirement: Thresholds are drafts for the owner
The proposed thresholds SHALL be stated in one file, marked as drafts, and SHALL be referenced by the promotion checklist.

#### Scenario: Checklist link
- **WHEN** the promotion checklist is read
- **THEN** it links to the thresholds file and says they await the owner's decision
