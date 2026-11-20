# Spec Delta

## Purpose
Which CRICOS levels the international course store keeps and how they are labelled, so a search can cover degrees, diplomas and VET without mixing them up.

## ADDED Requirements

### Requirement: Levels in scope
The system SHALL keep courses at the higher-education levels and at Diploma, Advanced Diploma and Certificate I to IV, and SHALL exclude school-level, Non AQF Award, Vocational Short Course and ELICOS courses, counting each excluded level in the validation report.

#### Scenario: Diploma kept
- **WHEN** a CRICOS row has the level Diploma
- **THEN** it is stored with the level group `diploma`

#### Scenario: Non-award excluded
- **WHEN** a CRICOS row has the level Non AQF Award
- **THEN** it is not stored and is counted in the validation report

### Requirement: Level group per level
The system SHALL map each kept level to exactly one level group by literal match of the published level and SHALL exclude any unrecognised level rather than guess its group.

#### Scenario: Unknown level
- **WHEN** a CRICOS row has a level the system does not recognise
- **THEN** it is excluded and counted

### Requirement: Sector as published
The system SHALL label a course as VET when the register gives it a VET National Code or when its level is Certificate I to IV, and SHALL leave the sector unset for a Diploma or Advanced Diploma with no code, without inferring it.

#### Scenario: Diploma without a code
- **WHEN** a Diploma has no VET National Code
- **THEN** its sector is not stated and the tool says so

### Requirement: VET National Code kept as published
The system SHALL store the VET National Code as published and SHALL store null where none is published.

#### Scenario: Code shown
- **WHEN** a VET course with a code is returned
- **THEN** the code is shown with the CRICOS attribution

### Requirement: Tools state their scope
The system SHALL describe the courses it covers as higher-education and VET levels in tool descriptions and results, and SHALL say that age, welfare and visa rules are not covered.

#### Scenario: Search description
- **WHEN** a host reads the search tool description
- **THEN** it names both sectors and says visa and welfare rules are not covered

### Requirement: Reload is atomic
The system SHALL replace all international course rows in one transaction when the wider level rule is first loaded, and SHALL keep the previous rows if the load fails.

#### Scenario: Failed reload
- **WHEN** the reload fails midway
- **THEN** the previous rows remain
