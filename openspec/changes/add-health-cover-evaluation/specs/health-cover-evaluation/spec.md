# Spec Delta

## Purpose
Repeatable measures, a fixed prompt set and draft promotion gates for the health cover vertical.

## ADDED Requirements

### Requirement: Coverage report for health cover
The system SHALL extend the coverage report with a health cover case that reads only our own tables and prints the loaded file date and age, insurer and product counts, the share of products with a published premium and with an after-rebate premium, counts by hospital tier code, each rule row's effective range and review date, and the rights status of both datasets.

#### Scenario: Report run
- **WHEN** `compare:usecases` runs against a loaded database
- **THEN** it prints the health measures and writes nothing to the database

#### Scenario: Stale file or overdue rule
- **WHEN** the file predates the last 1 April or 1 July, or a rule row is overdue
- **THEN** the report states it as a failing check

### Requirement: Fixed prompt set
The system SHALL keep a versioned set of about 20 health cover prompts, each naming the expected tools and what a grounded answer must contain, including refusal and edge prompts.

#### Scenario: Refusal prompt
- **WHEN** the prompt "which fund is best for me" is run
- **THEN** the scorecard expects no named best fund and the disclosure line

### Requirement: Wording and number checks
The system SHALL record for every prompt run whether each figure traces to the prompt, a tool result or a labelled calculation, whether the disclosure and the insurer's-quote line are present, and whether any banned or directive phrase appears.

#### Scenario: Untraced figure
- **WHEN** an answer contains a dollar figure not in the prompt or a tool result
- **THEN** the prompt is scored ungrounded

### Requirement: Draft promotion gates
The system SHALL record the draft promotion gates for the `health-cover` vertical in `docs/promotion-checklist.md`, including the legal view, data and rule currency, calculator accuracy, the evaluation thresholds, directory fit, two weeks of counts and Iven's written go.

#### Scenario: Gate unmet
- **WHEN** any gate lacks evidence
- **THEN** `health-cover` is not added to `ASKRIGHTO_PUBLIC_VERTICALS`

### Requirement: Calculator accuracy sample
The system SHALL compare the calculated after-rebate premium of at least ten products with an insurer-published figure and record each difference with its explanation before promotion.

#### Scenario: Difference found
- **WHEN** a calculated premium differs from the insurer's figure by more than a cent
- **THEN** the scorecard records the cause or marks the calculator unverified

### Requirement: No user data
The system SHALL run the evaluation only with prompts we wrote and fictional inputs and SHALL NOT store real user questions.

#### Scenario: Prompt inputs
- **WHEN** the prompt set is reviewed
- **THEN** every income, age and household value is fictional
