# Spec Delta

## Purpose

Holds the VCE and VTAC admissions reference data that course questions depend on (key dates, preference rules, early entry schemes, the aggregate counting rule, subject scaling and study area groupings), each traceable to its official page and each switched on by its own rights entry.

## ADDED Requirements

### Requirement: Each source is its own dataset with its own rights status
Key dates, preference rules, early entry schemes, scaling and study area groupings SHALL each be registered as a separate dataset with its own rights entry, so one source being unavailable does not withhold the others.

#### Scenario: Scaling permission pending
- **WHEN** the `vce-scaling` rights status is `pending` in production
- **THEN** key dates, preference rules and early entry schemes are still served, and scaling-based results return `data_unavailable`

### Requirement: Dates, rules and schemes are own-words facts with links
Every key date, preference rule and early entry scheme SHALL be stored in our own words with its official source URL, the admissions year it belongs to and the date it was checked, and SHALL carry a provisional flag where the publisher marks it provisional.

#### Scenario: Provisional exam period
- **WHEN** VCAA lists a future exam period as provisional
- **THEN** the stored date has `provisional: true` and its source URL

#### Scenario: Date without a source
- **WHEN** a curated date has no source URL or checked date
- **THEN** validation fails and the date is not loaded

### Requirement: No eligibility verdict for early entry schemes
Early entry scheme conditions SHALL be stored and returned as published conditions in our own words, and the system SHALL NOT evaluate whether a student meets them.

#### Scenario: Scheme with a school recommendation condition
- **WHEN** a scheme requires a principal's recommendation
- **THEN** the condition is stored as text with the scheme link, and no field records whether any student qualifies

### Requirement: Aggregate follows the published counting rule
The aggregate calculation SHALL apply VTAC's published counting rule: at least four studies including one English-group study, the best English-group scaled score plus the next three best permissible scaled scores, 10% of up to two further scores, and the study area grouping limits for that study year. It SHALL return each study's role and SHALL NOT convert the aggregate to an ATAR.

#### Scenario: No English-group study
- **WHEN** the studies given include no English-group study
- **THEN** the result is not computed with reason `needs_english`

#### Scenario: Three studies from one grouping
- **WHEN** three of the best studies fall in one study area grouping
- **THEN** at most two of them count in the primary four, and the result says which was moved and why

#### Scenario: Six studies
- **WHEN** six eligible studies are given
- **THEN** the aggregate is the primary four plus 10% of the fifth and sixth, and each study's role is returned

### Requirement: Scaled scores only from published points
Scaled scores SHALL come from the stored scaling table for the stated study year; a study score between published points SHALL be interpolated linearly and marked as interpolated; a study score outside the published range SHALL NOT be scaled.

#### Scenario: Study score between points
- **WHEN** a scaled score is asked for at study score 33
- **THEN** it is interpolated between the published values at 30 and 35 and flagged as interpolated, naming both points

#### Scenario: Study score below the table
- **WHEN** a scaled score is asked for at study score 15
- **THEN** the result is not computed with reason `outside_published_range`

### Requirement: Pending scaling data is never committed or served
Scaling and study area grouping data SHALL NOT be committed to the repository or served in production until VTAC's written permission is recorded in the data rights register.

#### Scenario: Development with the pilot table
- **WHEN** a developer runs the aggregate tests with a local copy in the git-ignored data folder
- **THEN** the tests run and no scaling file appears in the commit

### Requirement: Admissions data is refreshed on a calendar
Key dates SHALL be re-checked each February and August, preference rules each August, early entry schemes each March and August, and scaling and groupings when VTAC publishes each year's report; each dataset SHALL warn when older than its expected refresh.

#### Scenario: New admissions year
- **WHEN** August arrives and the next admissions year's dates are not stored
- **THEN** the key dates dataset reports a staleness warning on every result
