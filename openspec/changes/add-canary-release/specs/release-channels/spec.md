# Spec Delta

## Purpose

Lets Ask Righto run a vertical for named testers on an internal canary instance, from the same image as the public server, keeps that instance private and compatible with production, and sets the gates a vertical must pass before the public server serves it.

## ADDED Requirements

### Requirement: Instances serve only their enabled verticals
An instance SHALL register tools, datasets, readiness checks, server instructions and scheduled jobs only for the verticals named in `ASKRIGHTO_VERTICALS`, SHALL default to `energy` when the setting is absent, and SHALL refuse to start on an unknown or empty vertical list.

#### Scenario: Public server without courses
- **WHEN** an instance starts with `ASKRIGHTO_VERTICALS=energy`
- **THEN** `tools/list` returns no course tools, `initialize` instructions have no course section, and no course readiness check or load job exists

#### Scenario: Unknown vertical
- **WHEN** an instance starts with `ASKRIGHTO_VERTICALS=energy,cuorses`
- **THEN** start-up fails and names the unknown vertical

### Requirement: Canary is reachable only on a secret path
When `ASKRIGHTO_MCP_PATH_TOKEN` is set, the instance SHALL serve MCP, readiness and metrics only under paths that include the token, SHALL return 404 for the plain and wrong-token paths, SHALL send `X-Robots-Tag: noindex`, and SHALL NOT write the token to any log.

#### Scenario: Wrong token
- **WHEN** a client posts to `/mcp` or to `/mcp/<wrong token>` on the canary
- **THEN** the response is 404 and the access log shows the path with the token masked

#### Scenario: Health check
- **WHEN** the playbook requests `/healthz` on the canary
- **THEN** it gets 200 without the token

### Requirement: Canary uses production rules for data rights
The canary SHALL run with production data-rights rules, so datasets that are not cleared stay unavailable there.

#### Scenario: Pending scaling data on the canary
- **WHEN** a tester asks the canary for an aggregate while VTAC scaling is `pending`
- **THEN** the result is `data_unavailable`, as on the public server

### Requirement: Schema stays compatible across instances
Migrations run by the canary SHALL be additive, and an instance SHALL start when the schema version is equal to or newer than the one it needs.

#### Scenario: Canary ahead of production
- **WHEN** the canary has applied an additive course migration that production's image does not know
- **THEN** production keeps starting and serving energy

#### Scenario: Non-additive migration
- **WHEN** a migration drops or changes a column an older image reads
- **THEN** the compatibility test in CI fails

### Requirement: Only one instance runs the energy sync
The energy sync job SHALL be scheduled only on the instance with `ASKRIGHTO_SYNC=on`.

#### Scenario: Canary start-up
- **WHEN** the canary starts without `ASKRIGHTO_SYNC=on`
- **THEN** it schedules no energy sync, and retailers see no extra traffic

### Requirement: Outcome counts hold no user content
The canary SHALL count tool outcomes (curated, index-only, cannot-check, not-found, unavailable, needs-input) and latency per tool, and SHALL NOT record arguments, results, course ids, IP addresses or session identifiers.

#### Scenario: After a course lookup
- **WHEN** a tester calls `get_course` for an index-only course
- **THEN** the `get_course` index-only counter rises by one and no log line or counter holds the course id or the question

### Requirement: Promotion needs recorded gates
A vertical SHALL be added to the public server's `ASKRIGHTO_VERTICALS` only through a pull request that records:
- that its datasets' rights are cleared, with no entries awaiting the legal view;
- that review-by dates are current;
- that its launch criteria are met;
- two weeks of canary counters without unexplained failures;
- Iven's explicit approval.

#### Scenario: Legal view outstanding
- **WHEN** a promotion is proposed while a course dataset is `cleared_pending_legal_view`
- **THEN** the promotion checklist fails and the vertical stays canary-only

#### Scenario: Rollback
- **WHEN** a promoted vertical misbehaves
- **THEN** removing it from the public flag and redeploying removes its tools, with no code change
