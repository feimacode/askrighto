# Spec Delta

## Purpose
Tools that let a host assistant search, look up and compare courses for international students from the CRICOS-based store, with every fact sourced and no advice.

## ADDED Requirements

### Requirement: Search courses
The system SHALL provide `search_intl_courses` filtering by text, level, field of education, state, campus location, provider, maximum total fee and maximum duration, returning at most a capped page of results and the number of matches that have no published fee.

#### Scenario: Filter by level and location
- **WHEN** a caller searches for master's courses in a named city
- **THEN** results list only courses of that level offered at a campus in that city, each with CRICOS code, provider, duration, indicative fee and source date

#### Scenario: Fee filter with missing fees
- **WHEN** a caller sets a maximum fee and some matching courses have no published fee
- **THEN** those courses are not counted as under the limit and the result states how many had no published fee

### Requirement: Get one course
The system SHALL provide `get_intl_course` returning every stored field for a CRICOS course code, with the indicative-fee label, as-of date, attribution and the domestic course link when present.

#### Scenario: Unknown code
- **WHEN** the code is not in the dataset
- **THEN** the result is `not_in_dataset` with no figures

#### Scenario: Expired course
- **WHEN** the register marks the course as expired
- **THEN** the course is returned with an expired label

### Requirement: Compare courses
The system SHALL provide `compare_intl_courses` for 2 to 5 course codes, comparing stored fields only, and SHALL show a yearly fee only when total fee and duration are both published, labelled as calculated.

#### Scenario: Yearly fee available
- **WHEN** both fee and duration are published
- **THEN** the yearly figure is shown with the label "calculated: total fee divided by duration"

#### Scenario: Yearly fee not available
- **WHEN** either value is missing
- **THEN** no yearly figure is shown

### Requirement: Entry checklist for the user's assistant
The system SHALL provide `get_intl_entry_checklist` returning the provider's official page link and a reading checklist, SHALL NOT fetch the page or return English scores, entry requirements, scholarships or intake dates, and SHALL tell the host to quote anything read with the page link and time and to label it as read by the assistant.

#### Scenario: Checklist request
- **WHEN** a caller asks what English level a course needs
- **THEN** the result contains the provider link, the checklist and the labelling rule, and no score

### Requirement: No immigration advice
The system SHALL state in the vertical's instructions and tool descriptions that it gives course facts only and no visa, migration, work-rights or post-study advice.

#### Scenario: Visa question
- **WHEN** a host asks the tools for visa or migration guidance
- **THEN** no tool returns such guidance and the instructions direct the host to the official Home Affairs site

### Requirement: Internal-only route first
The system SHALL serve the international tools only on the internal route until the vertical is named in `ASKRIGHTO_PUBLIC_VERTICALS`.

#### Scenario: Public route
- **WHEN** a client lists tools on `/mcp` without the vertical being public
- **THEN** no international tool is listed
