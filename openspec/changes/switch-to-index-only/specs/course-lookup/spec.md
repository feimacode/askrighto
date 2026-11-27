# Spec Delta

## Purpose
Domestic course lookup from the CRICOS index, with links and a reading checklist for everything else.

## MODIFIED Requirements

### Requirement: Search domestic courses
The system SHALL provide `search_domestic_courses` over the CRICOS index only, filtering by text, provider, level, field, state and campus, returning CRICOS code, provider, campuses, duration and the provider's course link.

#### Scenario: Domestic-only course absent from CRICOS
- **WHEN** no index row matches
- **THEN** the result says the index has no row, that CRICOS lists courses registered for international students, and gives the provider's course search link

### Requirement: Get one domestic course
The system SHALL provide `get_domestic_course` returning one CRICOS row, the provider course link, Course Seeker and VTAC search links (links only) and a reading checklist covering the entry figure with its kind and intake year, VCE prerequisites with study scores, other criteria and campus.

#### Scenario: Depth stated
- **WHEN** a course is returned
- **THEN** the result says it holds no entry figures or prerequisites and that the agent must read the official page

## REMOVED Requirements

### Requirement: Compare domestic courses
**Reason**: Needs stored facts; the agent compares what it read.

### Requirement: Check domestic course prerequisites
**Reason**: Needs stored prerequisite rules, which are no longer kept.

### Requirement: Curated course facts
**Reason**: Own-worded course facts need a legal view and carry copyright risk; replaced by guided reading.
