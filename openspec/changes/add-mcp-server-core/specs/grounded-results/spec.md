# Spec Delta

## Purpose

Makes every fact Ask Righto returns traceable: each tool result names where the data came from, when it was current, and says plainly when nothing was found, so the host model never has to fill a gap with a guess.

## ADDED Requirements

### Requirement: Results carry source and as-of date
Every successful tool result that contains data SHALL include a `source` with the publisher's name, a URL where the user can check the data, and the licence or reuse basis, and an `asOf` date-time saying when the data was last current at the source or last fetched.

#### Scenario: Tool returns data
- **WHEN** a tool returns one or more facts
- **THEN** the structured result has `found: true`, `source.name`, `source.url`, `source.licence` and `asOf`

#### Scenario: Items come from different source pages
- **WHEN** a result lists several items that each have their own official page
- **THEN** each item carries its own URL and as-of date in addition to the result-level source

### Requirement: Explicit not-found
When a tool has no data for the request, it SHALL return `found: false` with a machine-readable reason and a plain-language message, and SHALL NOT return an estimate, a nearby value or an empty success.

#### Scenario: Unknown identifier
- **WHEN** a tool is asked for an item that is not in the data
- **THEN** the result has `found: false`, a reason such as `not_in_dataset`, and no data fields

#### Scenario: Input outside coverage
- **WHEN** a tool is asked about an area or category the dataset does not cover
- **THEN** the result has `found: false` with reason `outside_coverage` and names what is covered

### Requirement: Text and structured forms agree
Every tool result SHALL include both structured content and a text form, and the text form SHALL state the same figures, the source name, the source URL and the as-of date.

#### Scenario: Text-only host
- **WHEN** a host that ignores structured content shows the text form
- **THEN** the user sees the figures with their source link and date

### Requirement: Required attribution is shown
When a data licence requires an attribution notice, every result built from that data SHALL include the notice in both forms.

#### Scenario: Licensed dataset with a required notice
- **WHEN** a tool returns data from a source whose licence requires attribution
- **THEN** the notice text appears in the result

### Requirement: Data source registry
The server SHALL offer a tool that lists every dataset it holds with publisher, licence or reuse basis, source URL, coverage and the time it was last refreshed.

#### Scenario: User asks where the data comes from
- **WHEN** the `list_data_sources` tool is called
- **THEN** it returns one entry per dataset with publisher, licence, URL, coverage and last refresh time

#### Scenario: No datasets loaded
- **WHEN** the tool is called before any dataset is loaded
- **THEN** it returns `found: false` with reason `no_data_loaded`

### Requirement: Stale data is flagged
When a dataset has not been refreshed within its expected cadence, results built from it SHALL carry a staleness warning naming the last refresh time.

#### Scenario: Refresh has been failing
- **WHEN** a tool answers from a dataset whose last refresh is older than its allowed age
- **THEN** the result includes a warning with the last refresh time
