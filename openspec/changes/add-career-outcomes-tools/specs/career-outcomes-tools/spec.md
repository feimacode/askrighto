# Spec Delta

## Purpose
Read-only tools that return published occupation facts with source, reference period and attribution.

## ADDED Requirements

### Requirement: Occupation search
The system SHALL provide `find_occupations`, which returns occupations whose stored title or keywords match the input, each with its code and classification.

#### Scenario: No match
- **WHEN** no occupation matches
- **THEN** the result is `found: false` with the JSA occupation page link

### Requirement: Occupation outlook
The system SHALL provide `get_occupation_outlook`, which returns the published profile facts and projection for one occupation with reference period, release date, source URL and attribution.

#### Scenario: Occupation with a projection
- **WHEN** the occupation has a stored projection
- **THEN** the result shows the figure, base year and horizon exactly as published and carries source and as-of date

#### Scenario: No projection published
- **WHEN** the occupation has none
- **THEN** the field is null and described as "not published"

### Requirement: Study paths only when published
The system SHALL provide `list_occupation_study_paths` only if the publisher states a link from occupation to qualification or field of study, and SHALL NOT infer one.

#### Scenario: No published link
- **WHEN** the data holds no stated link
- **THEN** the tool is not registered and the outlook result includes the official occupation page link

### Requirement: Out-of-scope statements
The system SHALL state in tool descriptions that salary, vacancies and migration advice are not covered, and SHALL NOT return a salary figure.

#### Scenario: Salary question
- **WHEN** a host asks about pay
- **THEN** the tools return no salary and the description tells the host to say it is not covered

### Requirement: Internal route first
The system SHALL serve these tools on the internal route until the promotion gates pass.

#### Scenario: Public route
- **WHEN** a client connects to the public `/mcp` route
- **THEN** the career tools are not listed
