# Spec Delta

## Purpose
A national, rebuildable store of courses open to international students, loaded from the CRICOS register, with published fees and durations labelled as such.

## ADDED Requirements

### Requirement: National CRICOS load
The system SHALL load providers, courses and course locations from the CRICOS register for all states and territories into tables separate from the domestic course index, and SHALL record the source file name and date of each load.

#### Scenario: Load replaces previous data
- **WHEN** `intl:load` runs on a newer CRICOS file
- **THEN** all international course rows are replaced in one transaction and the stored source date is the new file's date

#### Scenario: Failed load keeps old data
- **WHEN** the file cannot be parsed
- **THEN** the previous rows remain and the command exits with an error

### Requirement: Levels in scope
The system SHALL load only the configured higher-education levels and SHALL exclude school-level, ELICOS and non-award courses.

#### Scenario: Excluded level
- **WHEN** a CRICOS row is a school or ELICOS course
- **THEN** it is not stored and is counted in the validation report

### Requirement: Facts as published
The system SHALL store duration, tuition fee, non-tuition fee, level, field of education and language of instruction exactly as the register publishes them, and SHALL store null where a field is not published.

#### Scenario: Missing fee
- **WHEN** a course has no published tuition fee
- **THEN** the stored fee is null and no fee is estimated or inferred

### Requirement: Fee labelling and attribution
The system SHALL label every fee "indicative, as published in CRICOS" with the source file date and SHALL attach the CRICOS attribution text from the rights register to every returned record.

#### Scenario: Record returned
- **WHEN** a course is returned
- **THEN** its fee carries the indicative label, the as-of date and the attribution

### Requirement: Link to domestic index
The system SHALL link an international course to the domestic course with the same CRICOS code when one exists.

#### Scenario: Course in both indexes
- **WHEN** a CRICOS code appears in the domestic and international tables
- **THEN** each record exposes the other's identifier

### Requirement: Facts CRICOS does not hold
The system SHALL NOT store or return English language scores, country-specific entry requirements, scholarships or intake dates as facts, and SHALL instead return the provider's official page link and a reading checklist for the user's own browsing assistant.

#### Scenario: English requirement asked
- **WHEN** a caller asks for the English requirement of a course
- **THEN** the result is a provider page link and checklist, labelled as to be read by the user's assistant, with no figure

### Requirement: Rights gate
The system SHALL return `data_unavailable` for international course data in production unless the `cricos` rights entry is cleared.

#### Scenario: Entry not cleared
- **WHEN** the rights entry is pending and the environment is production
- **THEN** every international tool returns `data_unavailable`
