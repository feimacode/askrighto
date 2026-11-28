# Spec Delta

## Purpose
Point the host at each state's official admissions pages, with a reading checklist, and store nothing.

## ADDED Requirements

### Requirement: State-aware admissions sources
The system SHALL provide `get_admissions_sources` taking a `state` (`vic`, `nsw`, `act`, `qld`) and a `topic`, returning for each matching entry the admissions centre, the certificate, the publisher, the link, the entry-figure names that state uses, and a reading checklist.

#### Scenario: Queensland scaling
- **WHEN** a caller asks for `state` qld and `topic` scaling
- **THEN** the result lists QTAC's scaling page with its checklist and no VTAC entry

#### Scenario: State not given
- **WHEN** a caller gives no state
- **THEN** the result is `needs_input` asking which state's admissions system applies and calls nothing

### Requirement: No stored admissions data
The system SHALL NOT store, cache or compute any scaled score, ATAR, aggregate, selection rank or date, and SHALL NOT fetch or read an admissions page itself.

#### Scenario: Scaling asked from memory
- **WHEN** a caller asks for a scaled score
- **THEN** the result gives the link and checklist and states that Ask Righto holds no scaled scores

### Requirement: No cross-state conversion
The system SHALL state in each result that entry figures from different states are different measures and SHALL NOT convert one into another.

#### Scenario: Aggregate and ATAR
- **WHEN** a result includes a state whose universities publish an aggregate
- **THEN** it says an aggregate is not an ATAR and gives no conversion

### Requirement: Unconfirmed links are labelled
The system SHALL show the unverified warning on any entry without a `checkedOn` date.

#### Scenario: New entry
- **WHEN** an entry has been indexed but not opened by a person
- **THEN** the result carries the warning

## RENAMED Requirements
- FROM: `get_vce_admissions_sources` TO: `get_admissions_sources`
- FROM: dataset `vce-admissions-links` TO: `admissions-links`
