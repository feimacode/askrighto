# Spec Delta

## Purpose
A rebuildable store of Jobs and Skills Australia occupation profiles and projections with provenance, attribution and honest nulls.

## ADDED Requirements

### Requirement: Load from published JSA files
The system SHALL load occupation profile facts and employment projections from the JSA files confirmed in the column check into `career_*` tables, and SHALL record each source file's name, release date and hash.

#### Scenario: Load replaces previous data
- **WHEN** `careers:load` runs on newer files
- **THEN** all career rows are replaced in one transaction and the stored release date is the new one

#### Scenario: Failed load keeps old data
- **WHEN** a file cannot be parsed
- **THEN** the previous rows remain and the command exits with an error

### Requirement: Classification kept as published
The system SHALL store occupation codes with the classification name and version the file uses, and SHALL NOT map between classification versions.

#### Scenario: Unknown code
- **WHEN** a file contains an occupation code not seen before
- **THEN** it is stored as published and reported by `careers:validate`

### Requirement: Facts as published
The system SHALL store values, units and reference periods as stated and SHALL store null where the file publishes no value.

#### Scenario: Missing projection
- **WHEN** an occupation has no published projection
- **THEN** the stored value is null and nothing is estimated

### Requirement: Licence per dataset
The system SHALL record the licence of each loaded dataset and SHALL refuse to load a dataset whose licence is not recorded in the rights register.

#### Scenario: Unregistered licence
- **WHEN** a file's dataset has no rights entry
- **THEN** the load stops with an error naming the dataset

### Requirement: Attribution and as-of date
The system SHALL attach the attribution text from the rights register and the file's reference period and release date to every result built from this data.

#### Scenario: Result returned
- **WHEN** any career result is returned
- **THEN** it names Jobs and Skills Australia, the licence, the source URL and the reference period
