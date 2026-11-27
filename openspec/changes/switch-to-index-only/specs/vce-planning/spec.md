# Spec Delta

## Purpose
VCE planning through links to the official scaling report, dates and early entry pages.

## ADDED Requirements

### Requirement: Admissions sources
The system SHALL provide a read-only tool returning the link to the most recent VTAC ATAR scaling report, VCAA study score information, VTAC key dates, VTAC preference information and each university's early offer page, each with a reading checklist and checked date.

#### Scenario: Scaling asked
- **WHEN** a caller asks for scaling
- **THEN** the result gives the report link and checklist and holds no scaled score

## REMOVED Requirements

### Requirement: Subject scaling lookup
**Reason**: Scaling data needs VTAC permission; the agent reads the report instead.

### Requirement: VCE aggregate estimate
**Reason**: Depends on stored scaling; the skill explains the aggregate rule with a link.

### Requirement: Key dates and early entry data
**Reason**: Stored own-worded facts replaced by links.
