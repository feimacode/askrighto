# Spec Delta

## Purpose
A repeatable way to compare the domestic course finder and the international CRICOS-based finder on the same measures, without collecting user data.

## ADDED Requirements

### Requirement: Coverage report
The system SHALL provide a command `compare:usecases` that reports, for the domestic and international course data, the number of rows, the share of rows holding each key fact, the age of each source and the rights status of each dataset, using only the system's own database.

#### Scenario: Both data sets loaded
- **WHEN** the command runs with both data sets loaded
- **THEN** it prints one section per use case with the counts, shares, source ages and rights status

#### Scenario: Empty table
- **WHEN** one data set has no rows
- **THEN** its section says no data is loaded and the command still succeeds

### Requirement: Read-only
The command SHALL NOT write to the database, call external services or log tool arguments.

#### Scenario: Run twice
- **WHEN** the command runs twice
- **THEN** the database is unchanged and the output differs only by data changes

### Requirement: Fixed prompt sets
The project SHALL keep a versioned prompt set of about 20 questions for each use case, each naming the expected tools and the properties of a grounded answer, and written in the same style across both sets.

#### Scenario: Prompt added
- **WHEN** a prompt is added
- **THEN** it names its expected tools and its grounded-answer properties

### Requirement: Scorecard
The project SHALL keep a scorecard template covering coverage, grounding, completeness, freshness and rights readiness for each use case and each tested host, and SHALL record whether a browsing assistant was used.

#### Scenario: Run recorded
- **WHEN** a prompt run is recorded
- **THEN** the scorecard row holds host, browsing assistant used or not, tools called, outcome counts before and after, and a grounded yes or no

### Requirement: No user data
The comparison SHALL use only prompts written by the project team and SHALL NOT store, log or analyse real user questions.

#### Scenario: Counters
- **WHEN** counters are read for the scorecard
- **THEN** only metadata-only outcome counts are used

### Requirement: Decision rules
The scorecard SHALL state the promotion rules (rights readiness passes, at least 80 percent grounded, no ungrounded figure, data under 45 days old) as drafts pending the owner's confirmation, and SHALL state that promotion follows the promotion checklist and the owner's go.

#### Scenario: Rule not met
- **WHEN** a use case fails any rule
- **THEN** the scorecard marks it not ready and names the failed rule
