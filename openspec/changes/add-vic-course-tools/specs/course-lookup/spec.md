# Spec Delta

## Purpose

Lets a VCE student or parent find Victorian undergraduate courses, see one course's published facts and compare courses, with every figure labelled by kind and year and linked to its official page, and with links instead of guesses when a course is not held.

## ADDED Requirements

### Requirement: Search courses
`search_courses` SHALL return courses matching the given name or keyword, field, university and campus, each with its university, campus, latest entry figure with kind and intake year, a prerequisites summary and the official page, ordered by name unless the user asks for figure order.

#### Scenario: Search by field and university
- **WHEN** the host searches for field "engineering" at university "RMIT"
- **THEN** the result lists RMIT engineering courses held in the store, each with its official URL and latest figure labelled by kind and year

#### Scenario: Filter by the student's studies
- **WHEN** the host passes `vceStudies` of English, Chemistry, Biology, Psychology and Further Maths
- **THEN** only courses whose prerequisites those studies can meet, ignoring study scores, are returned, and the result says that scores were not considered

#### Scenario: Filter by a figure
- **WHEN** the host passes `figureAtMost` 75
- **THEN** only courses whose latest lowest selection rank is at or below 75 are returned, and the result names the figure kind and year used

#### Scenario: Unknown study name
- **WHEN** a `vceStudies` entry matches no VCE study or several
- **THEN** the result has `found: false`, reason `needs_input`, and the candidate study names

### Requirement: Show one course
`get_course` SHALL return our summary, every stored entry figure with its kind, intake year, campus, source URL and checked date, the prerequisites for the entry year asked with their rules and display text, other selection criteria, campuses, CRICOS and VTAC codes where held, and the official page.

#### Scenario: Prerequisites for a later year not yet stored
- **WHEN** the host asks for entry year 2029 and only 2028 prerequisites are stored
- **THEN** the result gives the 2028 prerequisites and a warning that 2029 prerequisites are not yet held

#### Scenario: Several figure kinds
- **WHEN** a course has both a lowest selection rank and a guaranteed ATAR stored
- **THEN** both are shown with their own fixed labels, and neither is called "the ATAR you need"

### Requirement: Compare courses
`compare_courses` SHALL show two to five courses side by side on the same fields (university, campus, duration, entry figures by kind and year, prerequisites, other criteria, official page) and SHALL NOT pick a winner.

#### Scenario: Figures from different years
- **WHEN** compared courses have latest figures from different intake years
- **THEN** each figure shows its own year, and the result warns that the figures are from different years

#### Scenario: Too many courses
- **WHEN** six course ids are given
- **THEN** the result has `found: false`, reason `needs_input`, and says at most five can be compared

### Requirement: Results state their depth
Every course result SHALL state its depth. A `curated` course SHALL return its stored facts. An `index_only` course SHALL return its index fields, its official university page and Course Seeker links, a reading checklist, and a message that Ask Righto holds no checked facts for it, and SHALL NOT return any entry figure or prerequisite.

#### Scenario: Index-only course
- **WHEN** the host asks for a course that is in the index with depth `index_only`
- **THEN** the result has depth `index_only`, the course's name, university, campuses and CRICOS code, both links, and the reading checklist, and no figures

#### Scenario: Mixed comparison
- **WHEN** `compare_courses` is given one curated and one index-only course
- **THEN** the curated course shows its facts and the index-only course shows `cannot_check` with its links and checklist

#### Scenario: Course not in the index
- **WHEN** the host asks for a course the index does not hold
- **THEN** the result has `found: false`, reason `not_in_dataset`, and the university's course search link when the university is known

### Requirement: Guided browsing stays on the user's side
The server SHALL NOT fetch course pages during a request and SHALL NOT accept or store facts the host read from a page. Host guidance SHALL tell a browsing host to read the university page first and Course Seeker second, never VTAC, to quote only the checklist items with the link and time read, to label them as read by the assistant, and to give the link instead of getting past any bot check.

#### Scenario: Host browses an index-only course
- **WHEN** a host with a browser agent receives an index-only result
- **THEN** the guidance it holds directs it to the official page with the checklist, and no request from our server reaches that page

### Requirement: Figures are presented as past results
Every course result SHALL label each entry figure with its kind and intake year using fixed wording, and SHALL include the standard course notice that past figures are not cut-offs or predictions, prerequisites are as published for the year shown, the official page decides, and the result is general information, not advice. No course result SHALL contain the words "chance", "you will get in", "best course" or "recommended".

#### Scenario: Any course result
- **WHEN** any course tool returns data
- **THEN** the structured and text forms both carry the notice, and a test fails if either lacks it or contains a banned phrase

### Requirement: Results render as components with a text fallback
Search, prerequisite check and date results SHALL render as an Inkview table, comparison results as an Inkview comparison and course detail as an entity card, each carrying the grounded source, and every host SHALL also receive the markdown form with the notice and source footer.

#### Scenario: Host without MCP Apps
- **WHEN** a text-only host calls `compare_courses`
- **THEN** it receives a markdown table with the same fields, the notice and the source footer

#### Scenario: Component fails validation
- **WHEN** the Inkview component for a result fails validation
- **THEN** the plain grounded result is returned and no figures are lost
