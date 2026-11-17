# Spec Delta

## Purpose

Lets Ask Righto serve a vertical to named testers on an internal route of the same instance while the public route does not show it, keeps that route private and the public route safe from it, and sets the gates a vertical must pass before the public route serves it.

## ADDED Requirements

### Requirement: Loaded and public vertical lists
The server SHALL load the verticals named in `ASKRIGHTO_VERTICALS` (default `energy`) and SHALL serve on `/mcp` only those named in `ASKRIGHTO_PUBLIC_VERTICALS`, and SHALL refuse to start on an unknown name, an empty list, or a public vertical that is not loaded.

#### Scenario: Unknown vertical
- **WHEN** the server starts with `ASKRIGHTO_VERTICALS=energy,cuorses`
- **THEN** start-up fails and names the unknown vertical

#### Scenario: Public vertical not loaded
- **WHEN** `ASKRIGHTO_PUBLIC_VERTICALS=energy,courses-domestic` and `ASKRIGHTO_VERTICALS=energy`
- **THEN** start-up fails and names `courses-domestic`

### Requirement: Public route shows nothing from internal-only verticals
On `/mcp`, `tools/list`, `tools/call`, `initialize` instructions and `list_data_sources` SHALL include only public verticals.

#### Scenario: Courses loaded but not public
- **WHEN** courses are loaded but not public and a client connects to `/mcp`
- **THEN** `tools/list` has no course tools, the instructions have no course section, `list_data_sources` lists no course dataset, and a `tools/call` naming `search_domestic_courses` fails as an unknown tool

### Requirement: Internal route is private
The server SHALL serve the internal route only at `/mcp-internal/<token>` when `ASKRIGHTO_INTERNAL_TOKEN` is set, SHALL return 404 for the plain path, a wrong token, or any internal path when no token is set, SHALL compare tokens in constant time, SHALL send `X-Robots-Tag: noindex` on internal responses, and SHALL NOT write the token to any log.

#### Scenario: Wrong token
- **WHEN** a client posts to `/mcp-internal` or `/mcp-internal/<wrong token>`
- **THEN** the response is 404 and the access log shows the path with the token masked

#### Scenario: Tester connects
- **WHEN** a tester's connector posts to `/mcp-internal/<token>`
- **THEN** `tools/list` returns the tools of every loaded vertical

### Requirement: Internal-only verticals cannot take the public route down
An internal-only vertical that fails to start SHALL be marked unavailable on the internal route without stopping the server. Public `/readyz` SHALL reflect public verticals only. Internal-only verticals' database queries SHALL run under a statement timeout.

#### Scenario: Course tables missing
- **WHEN** the server starts with courses loaded but not public, and the course migration has not run
- **THEN** the server starts, `/mcp` serves energy, `/readyz` reflects energy only, and course tools on the internal route return `data_unavailable`

#### Scenario: Slow course query
- **WHEN** a course query runs past the statement timeout
- **THEN** it is cancelled and that call returns `data_unavailable`, and energy calls are unaffected

### Requirement: Both routes use production rules for data rights
In production, the data rights gate SHALL apply on the internal route exactly as on the public route.

#### Scenario: Pending scaling data on the internal route
- **WHEN** a tester asks for an aggregate on the internal route while VTAC scaling is `pending`
- **THEN** the result is `data_unavailable`

### Requirement: Outcome counts hold no user content
The server SHALL count tool outcomes (curated, index-only, cannot-check, not-found, unavailable, needs-input) and latency per tool and route, SHALL expose them only on the token-protected metrics path, and SHALL NOT record arguments, results, course ids, IP addresses or session identifiers.

#### Scenario: After a course lookup
- **WHEN** a tester calls `get_domestic_course` for an index-only course
- **THEN** the internal `get_domestic_course` index-only counter rises by one and no counter or log line holds the course id or the question

### Requirement: Promotion needs recorded gates
A vertical SHALL be added to `ASKRIGHTO_PUBLIC_VERTICALS` only through a change that records:
- that its datasets' rights are cleared, with no entries awaiting the legal view;
- that review-by dates are current;
- that its launch criteria are met;
- two weeks of internal counts without unexplained failures;
- Iven's explicit approval.

#### Scenario: Legal view outstanding
- **WHEN** a promotion is proposed while a course dataset is `cleared_pending_legal_view`
- **THEN** the promotion checklist fails and courses stay internal-only

#### Scenario: Rollback
- **WHEN** a promoted vertical misbehaves
- **THEN** removing it from `ASKRIGHTO_PUBLIC_VERTICALS` and redeploying removes its tools from `/mcp`, with no code change
