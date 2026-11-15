# Spec Delta

## Purpose

Holds an index of every Victorian university undergraduate course (CRICOS base plus hand-filled gaps, with official links), and, attached to it, curated facts in our own words (entry figures, prerequisites, selection criteria) for the courses that need them, so the course tools can always find a course and answer from checked facts where they exist instead of scraped or guessed ones.

## ADDED Requirements

### Requirement: Facts come only from permitted sources
Course facts SHALL come only from the providers' own published pages and guides, re-keyed in our own words, or from CRICOS under its CC BY licence, or from a source whose written permission is recorded in the data rights register. The store SHALL NOT contain data read from VTAC CourseSearch, Course Seeker, UAC or QTAC without recorded permission, and SHALL NOT contain the previous pilot's scraped course CSVs.

#### Scenario: Fact cites a TAC page without permission
- **WHEN** a curated fact's source URL is on `vtac.edu.au` or `courseseeker.edu.au` and that source's rights status is not cleared
- **THEN** validation fails and names the fact

#### Scenario: Pilot CSV in the data folder
- **WHEN** `vtac-courses.csv`, `uac-nsw-courses.csv` or `qtac-qld-courses.csv` is present anywhere the loader reads
- **THEN** validation fails

### Requirement: Summaries are in our own words
Every course summary and paraphrased prerequisite text SHALL be written in our own words, at most 60 words for a summary, and SHALL NOT share a run of 12 or more identical words with the official page it cites.

#### Scenario: Copied sentence
- **WHEN** the page checker finds a 12-word run shared between a summary and its official page
- **THEN** it flags the course for rewording and the release checklist fails until it is fixed

### Requirement: Every entry figure is labelled
Each stored entry figure SHALL carry its kind (`lowest_atar`, `lowest_selection_rank`, `guaranteed_atar`, `entry_threshold` or `median_atar`), its intake year, the campus where published per campus, its source URL and the date it was checked. A figure missing any of these SHALL be rejected.

#### Scenario: Unlabelled ATAR
- **WHEN** a curated file has a figure with a value but no kind or no intake year
- **THEN** validation fails and the figure is not loaded

#### Scenario: Several kinds for one course
- **WHEN** a university publishes both a lowest selection rank and a guaranteed ATAR for a course
- **THEN** both are stored as separate figures with their own kinds

### Requirement: Prerequisites are structured
Each course's prerequisites SHALL be stored as rules over known VCE studies with minimum study scores, alternatives and EAL variants, together with display text and the intake year they apply to. Advice that is recommended but not required SHALL be stored as a recommended criterion and SHALL NOT be stored as a rule.

#### Scenario: Either-or maths prerequisite
- **WHEN** a course requires English at 25 and either Maths Methods or Specialist Maths at 25
- **THEN** the stored rules are an all-of group containing an English-group leaf and an any-of group of the two maths studies, each with minimum score 25

#### Scenario: Unknown study name
- **WHEN** a prerequisite leaf names a study not in the VCE study list
- **THEN** validation fails and names the study

#### Scenario: Recommended background
- **WHEN** a course page says a subject is recommended but not required
- **THEN** it is stored as a recommended criterion, not as a rule

### Requirement: Store is rebuildable from the repository
The course store SHALL be loaded only from the curated files in the repository and the public CRICOS download, in one transaction, and SHALL record the commit it was loaded from.

#### Scenario: Load replaces the set
- **WHEN** `courses:load` runs on a new commit
- **THEN** the course tables match the curated files exactly, and the load record holds the commit, the course count and the figure count

#### Scenario: Load fails part way
- **WHEN** a load fails validation or the database errors
- **THEN** the previously loaded set stays in place unchanged

### Requirement: Facts are re-checked each admissions year
Every curated fact SHALL carry a checked date, and the dataset SHALL warn when it is older than 400 days. Entry figures SHALL be re-checked from August each year, when universities publish new figures, and prerequisites SHALL also be re-checked each March.

#### Scenario: Figure for an old intake
- **WHEN** a provider has published figures for a later intake year than the one stored
- **THEN** the page checker reports the course for update

### Requirement: One index covers every course
The course index SHALL hold one row for every undergraduate course at a Victorian university that is listed in CRICOS or added as a gap fill, and each row SHALL state its origin (`cricos` or `gap_fill`) and its depth (`index_only` or `curated`). Curated facts SHALL attach to an index row and SHALL NOT exist without one.

#### Scenario: CRICOS course with no curated facts
- **WHEN** a VIC university bachelor course is in the CRICOS download and has no curated entry
- **THEN** it is loaded as an index row with depth `index_only`, its CRICOS name, campuses and duration, and its official link where one is listed

#### Scenario: Course gains curated facts
- **WHEN** curated facts are added to an index-only course's entry and loaded
- **THEN** the same row becomes depth `curated` and keeps its id

#### Scenario: Course leaves CRICOS
- **WHEN** a CRICOS course is no longer in the download and has no curated entry
- **THEN** the next load removes its index row

### Requirement: Gaps in CRICOS are filled by hand and reported
The system SHALL report courses on a university's own published course list that are missing from the index, and a gap-filled row SHALL record where the course was found and its official link.

#### Scenario: Domestic-only course
- **WHEN** a university lists a domestic-only course that CRICOS does not hold
- **THEN** the gap report names it, and once a gap row is added it loads with origin `gap_fill` and its `foundAt` link

#### Scenario: Index row without a link
- **WHEN** an index row has no official course link
- **THEN** it is still loaded, the load report lists it, and tools give the university's course search link instead

### Requirement: CRICOS fields carry their licence
Fields taken from CRICOS SHALL be shown with the CC BY 2.5 AU licence and attribution, and SHALL NOT be presented as entry figures or prerequisites, since CRICOS holds none.

#### Scenario: Name mismatch with a curated entry
- **WHEN** a curated entry's name differs from its CRICOS course name
- **THEN** the load report warns and names the course, and the curated name is used only if it has a source

### Requirement: Dataset is registered and gated
The `vic-courses` dataset (index and curated facts) SHALL be registered with publisher, reuse basis, coverage and last load time, and a readiness check SHALL report not ready until a course load has completed.

#### Scenario: Fresh deploy before the first load
- **WHEN** the server starts and no course load has run
- **THEN** readiness reports that course data is not loaded, and `list_data_sources` shows the dataset without a refresh time
