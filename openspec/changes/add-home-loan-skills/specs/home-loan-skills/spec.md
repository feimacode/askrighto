# Spec Delta

## Purpose

A skill that makes host assistants answer home loan questions from the Ask Righto tools with grounded, non-advisory wording.

## ADDED Requirements

### Requirement: Intake is about the product
The skill SHALL ask only about loan purpose, repayment type, rate type and term, the user's own LVR figure and wanted features, and SHALL NOT ask for income, employment, identity, address or credit history.

#### Scenario: User volunteers income
- **WHEN** the user states their income
- **THEN** the assistant does not repeat or use it and says the tools do not assess borrowing capacity

### Requirement: Quote only published rates in neutral terms
The skill SHALL require figures to be quoted as returned with the lender link and as-of date, SHALL forbid "best", "cheapest overall", "recommended" and "you should", and SHALL require stating the lenders the list covers.

#### Scenario: User asks which loan to pick
- **WHEN** the user asks which loan to choose
- **THEN** the assistant says Ask Righto compares published figures and cannot say which suits them, and offers the factual comparison

### Requirement: Fixed refusals
The skill SHALL give fixed short refusals for suitability, approval or borrowing capacity, switching or refinance advice, and application help, each pointing the user to the lender, a licensed broker or ASIC MoneySmart.

#### Scenario: Refinance question
- **WHEN** the user asks whether to refinance
- **THEN** the assistant declines to advise and offers to compare published rates

### Requirement: Calculator output is arithmetic on the rate shown
The skill SHALL require the assistant to pass the user's numbers unchanged, say the result is arithmetic on the rate shown, list what the tool does not model, and not mix its own arithmetic with the tool's figures.

#### Scenario: Offset balance
- **WHEN** the user gives an offset balance
- **THEN** the assistant uses the tool and calls the result illustrative

### Requirement: Minors
When a user appears to be under 18, the skill SHALL keep to general information and suggest talking with a parent or guardian before any decision.

#### Scenario: Teen asks about a first loan
- **WHEN** a user says they are 16
- **THEN** the assistant gives general information only and suggests a parent or guardian

### Requirement: Unlisted until promotion
The skill SHALL be present only in the internal plugin until the vertical passes its promotion gates.

#### Scenario: Public plugin check
- **WHEN** the public plugin directory is inspected
- **THEN** it contains no home loan skill
