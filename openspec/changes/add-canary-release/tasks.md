# Tasks

## 1. Vertical flags and routes

- [x] 1.1 Add `src/verticals.ts` with the two lists (defaults, unknown, empty and not-loaded checks) and a registry in which each vertical registers tools, datasets, readiness checks, instructions and jobs tagged by vertical; verify unit tests for each start-up rule
- [x] 1.2 Move energy into the registry with no behaviour change; verify the existing energy and smoke tests pass unchanged on `/mcp`
- [x] 1.3 Build the per-request MCP server from the route's verticals (tools, instructions, `list_data_sources`); verify a smoke test that `/mcp` lists no course tools, rejects a course tool call by name and has no course instructions, while the internal route lists them
- [x] 1.4 Add the internal route `/mcp-internal/<token>`: off without a token, 404 for plain or wrong tokens, constant-time compare, `X-Robots-Tag: noindex`, token masked in the access log; verify HTTP tests and a log test

## 2. Isolation

- [x] 2.1 Mark an internal-only vertical failed when its registration throws or its tables are missing, without stopping start-up; verify a test with missing course tables
- [x] 2.2 Make public `/readyz` reflect public verticals only and add `/readyz-internal/<token>` reporting each loaded vertical; verify tests
- [x] 2.3 Apply a statement timeout to internal-only verticals' queries; verify a test that a slow query returns `data_unavailable` while an energy call succeeds

## 3. Counters

- [x] 3.1 Add in-memory outcome and latency counters per tool and route, exposed at `/metrics-internal/<token>` in Prometheus text form; verify tests that counters change on calls and that no counter or log holds arguments or course ids

## 4. Infra and docs

- [x] 4.1 Write the internal route and promotion section of `docs/deploying.md` (settings, vault token, rotation, how to connect a tester) and a release-channels section in `docs/architecture.md`; verify the settings names match the code
- [ ] 4.2 Hand the infra settings to feima-infra: `ASKRIGHTO_VERTICALS=energy,courses-domestic`, `ASKRIGHTO_PUBLIC_VERTICALS=energy`, vault `vault_askrighto_internal_token` mapped to `ASKRIGHTO_INTERNAL_TOKEN`; verify after deploy that `/mcp` shows energy only and the internal route shows courses NOT DONE here: feima-infra is a separate private repo; settings are written up in `docs/deploying.md`.
- [ ] 4.3 Write the tester note and share the internal URL directly with the named testers only; verify the URL appears nowhere in the repo, plugin bundles or listing material NOT DONE: Iven shares the URL; the note is in `docs/deploying.md`.

## 5. Promotion

- [x] 5.1 Add `docs/promotion-checklist.md` with the five gates; verify the course vertical's promotion change will reference it
- [x] 5.2 Confirm the rights register applies production rules on both routes before the first deploy with courses loaded; note it in the pull request

## Workflow follow-up

- Archive the change after review so `release-channels` becomes a main spec.
- Revisit OAuth for both routes before the directories open or if the tester group grows.
