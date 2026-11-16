# Spec Delta

## Purpose

Keeps course answers factual and bounded: what a student's studies satisfy, what past figures were, and where the official page is, without odds, advice or invented facts.

## ADDED Requirements

### Requirement: VCE intake and wording
The `vce-course-research` skill SHALL tell the host to ask which VCE studies the student takes before a prerequisite check, to quote every figure with its kind and intake year, to never state or imply a chance of entry, and to never convert an aggregate to an ATAR.

#### Scenario: Student asks if they will get in
- **WHEN** the student asks whether they will get into a course
- **THEN** the host gives last year's published figure with its kind and year and says it is not a cut-off

### Requirement: Index-only courses
The skill SHALL tell the host that index-only courses have no checked facts, and to give the official links and, if it can browse for the user, read only the checklist items, quoting them with page link and time read, labelled as read by the assistant, and never getting past a bot check.

#### Scenario: Browsing blocked
- **WHEN** the university page shows a bot check
- **THEN** the host gives the link and stops

### Requirement: No visa or migration advice
The `intl-course-finder` skill SHALL tell the host not to give visa or migration advice, to label fees as indicative, and to point to official government sources.

#### Scenario: Visa question
- **WHEN** the user asks whether they will get a visa
- **THEN** the host declines to advise and points to the official source

### Requirement: Unlisted until promoted
The course skills SHALL NOT appear in the public marketplace entry until the matching vertical has passed its promotion gates.

#### Scenario: Public bundle check
- **WHEN** the public plugin entry is built before promotion
- **THEN** it contains no course skill
