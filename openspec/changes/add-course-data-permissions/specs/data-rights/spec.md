# Spec Delta

## Purpose

Records why Ask Righto may reuse each data source, keeps any source without a recorded right out of production, carries required attribution to the user, and gives data owners a way to get facts corrected or removed.

## ADDED Requirements

### Requirement: Every dataset has a rights entry
Every dataset registered with the data source registry SHALL have an entry in the data rights register naming its owner, its reuse basis (`open_licence`, `cdr_rule`, `written_permission` or `own_words_facts`), its status, and the evidence for the basis with the date it was read.

#### Scenario: Dataset without an entry in production
- **WHEN** the server starts in production and a registered dataset has no rights entry
- **THEN** start-up fails with an error naming the dataset

#### Scenario: Register forms disagree
- **WHEN** the human register and the machine register list different dataset ids
- **THEN** the test suite fails

### Requirement: Uncleared data is not served in production
In production, a tool that reads a dataset whose rights status is not `cleared` or `cleared_pending_legal_view` SHALL return `found: false` with reason `data_unavailable` and a plain message that the data is not available yet, and SHALL NOT return any figure from that dataset.

#### Scenario: Scaling data waiting on permission
- **WHEN** a production user asks a tool that needs the VTAC scaling table and its status is `pending`
- **THEN** the result has `found: false`, reason `data_unavailable`, the dataset id in `details`, and no scaled scores

#### Scenario: Development build
- **WHEN** the same tool runs in a development or test build
- **THEN** it returns the data with a warning that the source is not yet cleared for production

#### Scenario: Data source listing
- **WHEN** `list_data_sources` is called in production
- **THEN** a dataset that is not servable is listed as not yet available, with its owner and no figures

### Requirement: Uncleared data stays out of the public repository
Data from a source whose status is `pending`, `refused` or `withdrawn` SHALL NOT be committed to the repository, which is public. Development copies of pending data SHALL live in a git-ignored local path.

#### Scenario: Pending scaling table in a commit
- **WHEN** a commit adds a data file for a dataset whose status is `pending`
- **THEN** the CI check fails and names the file

### Requirement: Refused or withdrawn data is removed
When a dataset's status becomes `refused` or `withdrawn`, the next data load SHALL delete its records from the store, not only hide them.

#### Scenario: Permission withdrawn
- **WHEN** an owner withdraws permission and the register is updated
- **THEN** after the next load the store holds no records from that dataset

### Requirement: Required attribution reaches the user
When a rights entry carries attribution wording, every result built from that dataset SHALL include it as `source.attribution` in structured content and in the text form.

#### Scenario: Permission granted with attribution
- **WHEN** a permission reply requires a notice and the register records it
- **THEN** every result from that dataset ends with the notice, and a test fails if any result omits it

### Requirement: Permission requests are drafted and logged
The project SHALL keep a draft request for each source whose basis needs permission, and a log of every request with recipient, scope, date sent, reply and conditions. The build SHALL NOT send requests.

#### Scenario: Request sent
- **WHEN** Iven sends a request
- **THEN** the log gains an entry with the recipient, what was asked, and the date, and the dataset stays `pending` until a reply is logged

### Requirement: Corrections are handled within five business days
The project SHALL publish a corrections contact and SHALL check, and correct or remove, a disputed fact within five business days of a request from its owner.

#### Scenario: University reports a wrong figure
- **WHEN** a university reports that a stored entry figure is wrong
- **THEN** the request is logged, the figure is checked against the official page, and the store is corrected or the figure removed within five business days

### Requirement: Terms are re-checked on a schedule
Each rights entry SHALL carry a review-by date, and a release SHALL NOT go out while any served dataset is past its review-by date.

#### Scenario: Review date passed
- **WHEN** a release is prepared and a served dataset's review-by date has passed
- **THEN** the release check fails and names the dataset
