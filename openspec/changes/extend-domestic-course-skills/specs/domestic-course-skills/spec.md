# Spec Delta

## Purpose
Give the host agent state-aware course research workflows that carry no data.

## ADDED Requirements

### Requirement: State-aware router skill
The internal plugin SHALL include `domestic-course-research`, which asks the student's status and state of study once, finds courses with the course tools, reads the official page, and hands off to the other skills.

#### Scenario: Student in Queensland
- **WHEN** a student says they study the QCE in Queensland
- **THEN** the skill uses the Queensland sources and never applies VCE rules

#### Scenario: State unclear
- **WHEN** the student names no state and no university
- **THEN** the skill asks which state before reading any admissions page

### Requirement: No data in skills
Skills and their reference files SHALL contain structure facts and wording only, and SHALL NOT contain any score, date, scaled value or admissions rule.

#### Scenario: Reference file review
- **WHEN** a reference file is added or changed
- **THEN** it records the page it was read from and the date, and holds no figure that appears on that page

### Requirement: Reading and quoting rules
Every skill SHALL tell the agent to quote read facts with link and time, label them as read by the assistant, never send them back to an Ask Righto tool, and stop at a bot check or login.

#### Scenario: Bot check
- **WHEN** a page shows a bot check
- **THEN** the skill tells the agent to give the link and stop

### Requirement: No entry prediction
Skills SHALL NOT say a student will get in, give odds, rank courses as best, judge eligibility for a scheme, or choose subjects for the student.

#### Scenario: Which subjects should I pick
- **WHEN** a student asks which subjects to pick
- **THEN** the skill explains it can compare their subjects with published prerequisites and the student decides

### Requirement: No cross-state figure comparison
Skills SHALL NOT compare or convert entry figures between states' systems.

#### Scenario: Interstate applicant
- **WHEN** a student studies in one state and applies in another
- **THEN** the skill points to each centre's rules and compares no figures

## RENAMED Requirements
- FROM: skill `vce-course-research` TO: `domestic-course-research`
