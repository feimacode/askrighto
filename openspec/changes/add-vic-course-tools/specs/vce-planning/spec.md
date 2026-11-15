# Spec Delta

## Purpose

Lets a VCE student check their studies against course prerequisites, see scaling and an aggregate from their expected study scores when that data is permitted, and find admissions dates and early entry schemes, all computed by code from stored facts and never stored about the student.

## ADDED Requirements

### Requirement: Check prerequisites by code
`check_course_prerequisites` SHALL evaluate each course's stored prerequisite rules for the entry year against the student's studies and, when given, expected study scores and EAL status, and SHALL return per course `met`, `not_met` with the missing studies or scores, `needs_scores` with the minimum scores involved, or `cannot_check` for an index-only course.

#### Scenario: Missing maths study
- **WHEN** a course needs Maths Methods or Specialist Maths and the studies include neither
- **THEN** the course is `not_met` and the result names both alternatives as missing

#### Scenario: Scores not given
- **WHEN** a course needs Chemistry at 25 and the student takes Chemistry but gave no scores
- **THEN** the course is `needs_scores` and the result states the minimum of 25

#### Scenario: EAL threshold
- **WHEN** a course needs English at 25 or EAL at 30 and the student is EAL with an expected 28
- **THEN** the course is `not_met` and the result says the EAL minimum is 30

#### Scenario: Selection criteria beyond prerequisites
- **WHEN** a course also requires a folio or interview
- **THEN** the result lists it beside the check and does not evaluate it

#### Scenario: Index-only course in the check
- **WHEN** one of the courses checked has depth `index_only`
- **THEN** that course is `cannot_check`, with its official links and the reading checklist, and the other courses are evaluated as usual

#### Scenario: Mismatched lists
- **WHEN** `studyScores` has a different length from `vceStudies`
- **THEN** the result has `found: false`, reason `needs_input`, and explains that scores must follow the order of the studies

### Requirement: Scaling and aggregate only from permitted data
`get_subject_scaling` and `estimate_vce_aggregate` SHALL compute only from the stored scaling and study area grouping data for the stated study year, SHALL mark interpolated scaled scores, SHALL return each study's role in the aggregate, and SHALL NOT convert an aggregate into an ATAR. In production they SHALL return `data_unavailable` while that data's rights status is not cleared.

#### Scenario: Aggregate from six studies
- **WHEN** the host gives six studies with expected study scores and scaling data is available
- **THEN** the result gives the aggregate, each study's scaled score and role, the study year of the scaling used, and the fixed text that an aggregate is not an ATAR

#### Scenario: Scaling not yet permitted
- **WHEN** a production user asks for an aggregate before VTAC permission is recorded
- **THEN** the result has `found: false`, reason `data_unavailable`, and no scaled scores

### Requirement: Key dates and early entry schemes with links
`get_vce_key_dates` SHALL return dates for the admissions year asked, each with its label, provisional flag, source URL and checked date. `list_early_entry_schemes` SHALL return schemes for the university or course asked with their published conditions in our words, dates and scheme page, and SHALL NOT state whether a student is eligible.

#### Scenario: Provisional exam dates
- **WHEN** the host asks for the next year's VCE exam period and VCAA marks it provisional
- **THEN** the result shows the dates as provisional with the VCAA link

#### Scenario: Eligibility question
- **WHEN** the host asks whether a student qualifies for a scheme
- **THEN** the result gives the scheme's conditions and link, with no yes or no

### Requirement: Nothing about the student is kept
The planning tools SHALL NOT ask for name, age, school or contact details, and SHALL NOT store or log the studies, scores or EAL status passed to them.

#### Scenario: After a call
- **WHEN** a prerequisite check or aggregate call completes
- **THEN** no database row or log line contains the studies or scores that were passed

### Requirement: Host guidance for course questions
The server instructions SHALL tell the host to search before naming courses, to quote figures with their kind and year, to never give odds or say a student will get in, to ask for studies before a prerequisite check and for scores only when needed, to never convert an aggregate to an ATAR, and to say when a fact came from its own web search rather than Ask Righto.

#### Scenario: Initialize
- **WHEN** a host initializes a session
- **THEN** the instructions it receives include the course section
