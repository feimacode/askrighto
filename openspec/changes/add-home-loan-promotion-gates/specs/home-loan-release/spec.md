# Spec Delta

## Purpose

Keeps the home loan vertical off the public route until its regulatory, data and behaviour gates are met, and gives a fast way to withdraw a lender or the whole vertical.

## ADDED Requirements

### Requirement: Public release is blocked by dataset status
`release:check` SHALL fail when `home-loans` is in the public vertical list and any home loan dataset is not `cleared`.

#### Scenario: Pending legal view
- **WHEN** a home loan dataset is `cleared_pending_legal_view` and `home-loans` is public
- **THEN** `release:check` fails naming the dataset

### Requirement: Production start-up needs the legal marker
In production, the server SHALL refuse to start with `home-loans` public unless `docs/legal/home-loans-view.md` exists and names a reviewer, a date and a scope.

#### Scenario: Marker missing
- **WHEN** `home-loans` is public in production and the file is absent
- **THEN** start-up fails with a message naming the file

### Requirement: Public tools follow the covered scope
On the public route the server SHALL register only the home loan tools named in `ASKRIGHTO_HOME_LOAN_TOOLS` and in the marker scope.

#### Scenario: Calculator out of scope
- **WHEN** the marker scope omits the calculator
- **THEN** `calculate_home_loan_repayments` is not listed on `/mcp`

### Requirement: Promotion gates are recorded
Promotion SHALL be made only through a pull request that ticks every home loan gate with evidence, including the legal view, cleared datasets, evaluation thresholds, two weeks of internal counts, listing text approval, corrections route and the owner's written go.

#### Scenario: Missing evidence
- **WHEN** a gate has no evidence in the pull request
- **THEN** the promotion is not merged

### Requirement: Wrong rates are withdrawn quickly
The system SHALL support removing a lender from all home loan results at read time through a setting, SHALL count excluded lenders in the coverage block, and a confirmed wrong rate SHALL be removed within one business day.

#### Scenario: Lender excluded
- **WHEN** a lender slug is in the exclusion setting
- **THEN** none of its products appear in search, get or compare, and the coverage block states how many lenders were excluded

### Requirement: Scheduled review
Home loan rights entries SHALL carry review dates of 1 March and 1 September, and an overdue review SHALL block promotion and raise a warning.

#### Scenario: Overdue review
- **WHEN** a review date has passed without an update
- **THEN** `release:check` reports it overdue
