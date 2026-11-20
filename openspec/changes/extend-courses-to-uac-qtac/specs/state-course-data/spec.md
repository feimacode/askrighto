# Spec Delta

## Purpose
Course coverage for every university listed through VTAC, UAC or QTAC, with each state's admissions terms kept separate and every fact traceable to an official page.

## ADDED Requirements

### Requirement: Region coverage
The system SHALL keep a course index for each of Victoria, NSW and the ACT, and Queensland, held as reviewed source files per region and rebuildable from them and the CRICOS download.

#### Scenario: Provider in several states
- **WHEN** a university has campuses in more than one state
- **THEN** it has one provider entry and its campuses carry their state

### Requirement: Admissions centre codes
The system SHALL store a course's admissions codes as a list of admissions centre and code, and SHALL NOT change an existing course id when a code is added.

#### Scenario: Course listed by two centres
- **WHEN** a course lists a VTAC code and a UAC code
- **THEN** both are stored and the course id is unchanged

### Requirement: Admissions centre sources blocked
The system SHALL reject a course fact whose source is a VTAC, UAC or QTAC page, and SHALL NOT load any file derived from their course search tools.

#### Scenario: UAC source
- **WHEN** a curated figure cites a uac.edu.au page
- **THEN** validation fails naming the rule

### Requirement: State figures labelled as published
The system SHALL label every entry figure with the kind and intake year the university states, and SHALL NOT present a figure from one state's system as comparable to another's.

#### Scenario: Adjustment factors
- **WHEN** a university publishes an ATAR and a separate adjustment factor scheme
- **THEN** each is stored with its own kind and neither is merged into the other

### Requirement: Curriculum-specific subject rules
The system SHALL hold subject catalogues for the VCE, the HSC and the QCE and SHALL check a prerequisite rule only against the catalogue of its own curriculum.

#### Scenario: Wrong curriculum
- **WHEN** a course in the NSW region has a rule naming a VCE study
- **THEN** validation fails

### Requirement: Stand-in retirement by review
The system SHALL replace a stand-in course with its CRICOS row only when a person has set the CRICOS code on the stand-in, and SHALL report likely matches without linking them.

#### Scenario: Name match without a code
- **WHEN** a stand-in has the same name and provider as a CRICOS course but no code
- **THEN** the match report lists it and the stand-in stays until a code is set

### Requirement: Internal only until gates pass
The system SHALL serve the NSW, ACT and Queensland courses on the internal route only, until the promotion checklist is complete for them.

#### Scenario: Public route
- **WHEN** the public route is queried for a Queensland course
- **THEN** the course vertical is not available there
