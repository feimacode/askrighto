# Tasks

## 1. Vertical flags

- [ ] 1.1 Add `src/verticals.ts` with flag parsing (default `energy`, fail on unknown or empty) and a registry where each vertical registers tools, datasets, readiness checks, instructions and jobs; verify unit tests for default, valid, unknown and empty lists
- [ ] 1.2 Move energy into the registry with no behaviour change; verify the existing energy and smoke tests pass unchanged
- [ ] 1.3 Make `tools/list`, instructions, readiness and job scheduling read from the registry; verify a smoke test that an `energy`-only instance lists no course tools and an `energy,courses` instance lists them
- [ ] 1.4 Gate the energy sync job on `ASKRIGHTO_SYNC=on`; verify a test that an instance without it schedules no sync
- [ ] 1.5 Report readiness per enabled vertical in `/readyz`; verify a test with energy ready and courses not loaded

## 2. Canary access

- [ ] 2.1 Add `ASKRIGHTO_MCP_PATH_TOKEN`: serve MCP, `/readyz` and `/metrics` only under the token path, 404 elsewhere, mask the token in the access log, keep `/healthz` open; verify HTTP tests for right, wrong and missing tokens and a log test
- [ ] 2.2 Add the `X-Robots-Tag: noindex` option; verify a header test
- [ ] 2.3 Add in-memory outcome and latency counters per tool with Prometheus text output; verify a test that counters change on calls and that no counter or log holds arguments or course ids

## 3. Schema compatibility

- [ ] 3.1 Change the start-up schema check from "equal" to "at least"; verify a test with a newer schema version
- [ ] 3.2 Add a CI job that runs the previous release image's smoke test against the schema after the current migrations; verify it fails on a deliberately non-additive migration

## 4. Infra and docs

- [ ] 4.1 Write the canary section of `docs/deploying.md` (vars, hostname, vault token, deploy command, token rotation, running course loads from the canary) and a release-channels section in `docs/architecture.md`; verify the commands match the role's variable names once the infra change exists
- [ ] 4.2 Hand the infra requirements to feima-infra: second container `prod-askrighto-canary` from the same role, `askrighto_verticals`, `askrighto_sync`, hostname `askrighto-canary.feimacode.com`, vault `vault_askrighto_canary_token`, Traefik route and Cloudflare DNS; verify the canary answers `/healthz` and `/mcp/<token>` after the playbook runs
- [ ] 4.3 Write the tester note (what is incomplete, how to reconnect after an update, how to report problems) and share the URL directly with the named testers only; verify the URL appears nowhere in the repo, plugin bundles or listing material

## 5. Promotion

- [ ] 5.1 Add a promotion checklist template (`docs/promotion-checklist.md`) with the five gates; verify the course vertical's promotion pull request will reference it
- [ ] 5.2 Confirm the rights register treats both instances as production before the first canary deploy; note it in the pull request

## Workflow follow-up

- Archive the change after review so `release-channels` becomes a main spec.
- Revisit OAuth for the canary, or for both instances, before the directories open or if the tester group grows.
