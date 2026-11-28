# Spec Delta

## Purpose

Defines the two Ask Righto deployments, production (pinned to a released version, energy only, listed in directories) and dev (the full internal feature set, tracking `main`, not listed), how they are separated, deployed and promoted between.

## ADDED Requirements

### Requirement: One vertical list per deployment
The server SHALL load, and serve on its MCP route, exactly the verticals named in `ASKRIGHTO_VERTICALS` (default `energy`), and SHALL refuse to start on an unknown name or an empty list. There SHALL be no second list that hides a loaded vertical from the MCP route.

#### Scenario: Production lists energy only
- **WHEN** production starts with `ASKRIGHTO_VERTICALS=energy`
- **THEN** `tools/list`, the `initialize` instructions and `list_data_sources` hold nothing from courses, home loans or health cover, and a `tools/call` naming `search_domestic_courses` fails as an unknown tool

#### Scenario: Dev lists every vertical
- **WHEN** dev starts with every known vertical in `ASKRIGHTO_VERTICALS`
- **THEN** `tools/list` holds the tools of every one of them

#### Scenario: Unknown vertical
- **WHEN** the server starts with `ASKRIGHTO_VERTICALS=energy,cuorses`
- **THEN** start-up fails and names the unknown vertical

### Requirement: Deployment channel
The server SHALL read `ASKRIGHTO_CHANNEL` (`stable` or `dev`, default `stable`), SHALL refuse to start on any other value, SHALL report the channel in `/healthz`, and SHALL NOT let it change data rights, tool schemas or tool results.

#### Scenario: Healthz reports the channel
- **WHEN** a client requests `/healthz` on dev
- **THEN** the body includes the version and `"channel":"dev"`

#### Scenario: Failing vertical on dev
- **WHEN** dev starts with a vertical whose tables are missing
- **THEN** the server starts, `/readyz` reports that vertical as failed, and its tools answer `data_unavailable` while other verticals work

#### Scenario: Failing vertical on stable
- **WHEN** a stable instance starts with a vertical that fails to start
- **THEN** start-up fails and names the vertical

#### Scenario: Dev notice
- **WHEN** a client initialises on dev
- **THEN** the server instructions begin with a sentence saying this is the dev endpoint and answers may be incomplete

### Requirement: Production is pinned to a release
Production SHALL be deployed from a released version of the image (`:<x.y.z>` or the `:stable` tag a release created), SHALL record the deployed version in feima-infra, and SHALL NOT follow `:latest`. Dev SHALL be deployed from `:latest`.

#### Scenario: Bare deploy of production
- **WHEN** the production playbook runs without a version override
- **THEN** it deploys the version pinned in feima-infra, not the head of `main`

#### Scenario: Merge to main
- **WHEN** a pull request merges to `main`
- **THEN** `:latest` is built and dev picks it up, and production does not change

### Requirement: Separate data and secrets
Each deployment SHALL have its own database and database role, its own profile signing key and its own access token. No secret value SHALL be shared between them, and no secret SHALL appear in the repository, the image or a pull request.

#### Scenario: Dev role against production
- **WHEN** the dev database role attempts to connect to the production database
- **THEN** the connection is refused

#### Scenario: Profile from the other deployment
- **WHEN** a readings profile signed on dev is submitted to production
- **THEN** production labels the estimate "not verified by Ask Righto"

### Requirement: Access to dev is private
When `ASKRIGHTO_ACCESS_TOKEN` is set, the server SHALL serve MCP only at `/mcp/<token>` and metrics only at `/metrics/<token>`, SHALL answer 404 for plain `/mcp`, a wrong token or a missing token, SHALL compare tokens in constant time, SHALL send `X-Robots-Tag: noindex` on those responses, and SHALL NOT write the token to any log. When it is unset, the server SHALL serve plain `/mcp` and no `/metrics` path.

#### Scenario: Wrong token
- **WHEN** a client posts to `/mcp` or `/mcp/<wrong token>` on dev
- **THEN** the response is 404 and the access log shows `/mcp/***` or `/mcp`, never the token

#### Scenario: Tester connects
- **WHEN** a tester's connector posts to `/mcp/<token>` on dev
- **THEN** `tools/list` returns the tools of every loaded vertical

#### Scenario: Production has no token
- **WHEN** a client posts to `/mcp` on production
- **THEN** the energy tools are served and `/metrics` answers 404

### Requirement: The internal route no longer exists
After cutover the server SHALL NOT serve `/mcp-internal`, `/readyz-internal` or `/metrics-internal`, and SHALL NOT read `ASKRIGHTO_INTERNAL_TOKEN` or `ASKRIGHTO_PUBLIC_VERTICALS`.

#### Scenario: Old internal URL
- **WHEN** a client posts to a former `/mcp-internal/<token>` URL on either deployment
- **THEN** the response is 404

### Requirement: Rights rules apply on both deployments
In both deployments the data rights gate SHALL apply as in production.

#### Scenario: Pending dataset on dev
- **WHEN** a tester asks on dev for data from a dataset marked `pending`
- **THEN** the result is `data_unavailable`

### Requirement: Packages and listings point at production
The public plugin, the ChatGPT zip, the Gemini extension and the directory listings SHALL name only the production host and SHALL contain none of the dev host, a token path, or a non-public skill or tool. The dev plugin SHALL carry the non-public skills and no token.

#### Scenario: Package check
- **WHEN** `plugin:build` and `check-plugin-zips` run
- **THEN** a package naming the dev host or a `/mcp/<token>`-shaped path fails by name

### Requirement: Smoke check per channel
`release:smoke` SHALL, for production, require `/healthz` to report the expected version and `/mcp` to list exactly `publicTools`, and SHALL, for dev (`--channel dev`), require channel `dev` and every tool of every known vertical, each read-only and not destructive.

#### Scenario: Course tool on production
- **WHEN** the production smoke check finds `search_domestic_courses` on `/mcp`
- **THEN** it fails and names the tool

### Requirement: Promotion is a production change
A vertical SHALL be served by production only after every gate in `docs/promotion-checklist.md` is recorded, by adding it to production's `ASKRIGHTO_VERTICALS` in feima-infra and releasing a version that lists its tools in `publicTools`. Rollback SHALL be removing it from that list and redeploying, with no code change.

#### Scenario: Legal view outstanding
- **WHEN** a promotion is proposed while a dataset is `cleared_pending_legal_view`
- **THEN** the checklist fails and the vertical stays on dev only

#### Scenario: Rollback
- **WHEN** a promoted vertical misbehaves
- **THEN** removing it from production's list and redeploying removes its tools from `/mcp`
