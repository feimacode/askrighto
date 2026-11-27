# Spec Delta

## Purpose
Rules for indexing a licence-heavy or regulated source so agents can fetch it, with no source data stored by Ask Righto.

## ADDED Requirements

### Requirement: No source data stored
The system SHALL NOT store, cache or log any figure, rule, product or text taken from an index-only source, other than the index entry itself and its how-to-read facts written in our own words.

#### Scenario: Index entry only
- **WHEN** an index-only area is loaded
- **THEN** its data is a list of links with checklists and a checked date, with no copied content

### Requirement: Index entry shape
Each source entry SHALL carry an id, title, publisher, URL, kind, reading checklist and the date a person last confirmed the link.

#### Scenario: Dead link
- **WHEN** the link checker finds a link that fails or redirects to a different page
- **THEN** the check reports the entry and the build of the next release fails until it is fixed

### Requirement: Tool results say where to read
Every tool in an index-only area SHALL return the source URL, the checked date and a notice that Ask Righto did not read the page.

#### Scenario: Source not in the index
- **WHEN** a caller asks for something with no entry
- **THEN** the result says so and gives the provider's own search link, never a figure

### Requirement: Facts read by the agent
Skills SHALL tell the agent to quote any fact it reads with the page link and time read, label it as read by the assistant, never send it back to Ask Righto tools, and stop at a bot check or login.

#### Scenario: Bot check
- **WHEN** the agent meets a bot check
- **THEN** it gives the link and stops

### Requirement: Link-only rights basis
The rights register SHALL support a `link_only` basis for an indexed source, and a dataset with that basis SHALL have no stored content.

#### Scenario: Register check
- **WHEN** the register is validated
- **THEN** a `link_only` entry with a table or file of source content fails validation
