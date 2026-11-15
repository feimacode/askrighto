# Design

## Context

- One image (`ghcr.io/feimacode/askrighto`, `:latest`, `:sha-…`, `:x.y.z`) is run by the `askrighto` Ansible role in feimacode/feima-infra on the shared Australia East VM, behind Traefik and Cloudflare, at `askrighto.feimacode.com` (internal test domain; `askrighto.com.au` later). Migrations are embedded and run by the playbook before the container starts; they are additive with no down migrations (`docs/deploying.md`).
- The server is stateless per request; tools are a fixed list in `src/tools/index.ts`; server instructions are a base text plus `addInstructions` from data modules; datasets register with `src/core/registry.ts`; `/healthz` and `/readyz` exist.
- Claude and ChatGPT connect to remote MCP servers from their own clouds, so an IP allow-list cannot tell our testers apart from anyone else using those hosts. Claude's and ChatGPT's custom connectors accept a URL and, optionally, OAuth; they do not let a user add arbitrary headers.
- Iven, 16 Nov 2026: the uni course vertical is internal-only for now, as a canary.

## Goals / Non-Goals

**Goals:**

- Run a vertical for named testers from the same code and image, without it appearing on the public server.
- One switch to promote or roll back a vertical.
- Learn from the canary (coverage, how often answers are index-only) without breaking statelessness.

**Non-Goals:**

- Strong per-user authentication.
- Gradual traffic shifting on the public URL.

## Decisions

**1. Vertical flags, read once at start-up.** `ASKRIGHTO_VERTICALS=energy,courses`. Each vertical is a module exporting `register(ctx)` that adds its tools, datasets, readiness checks, instructions and scheduled jobs. Start-up registers only the listed ones and fails on an unknown name or an empty list. Default when unset: `energy`, so an instance never exposes a vertical by accident. Alternative: register everything and hide tools per request. Rejected: hosts cache tool lists, and a hidden-but-registered tool still runs its jobs and readiness checks. Alternative: separate images per channel. Rejected: two builds to keep in step; the flag keeps one image.

**2. Canary is a second instance, not a route on the public one.** Same image (usually `:latest` or a specific `:sha-…` under test), its own container, hostname `askrighto-canary.feimacode.com`, `ASKRIGHTO_VERTICALS=energy,courses`. Energy stays on the canary so testers can check that nothing regressed. Alternative: one instance with a secret path that unlocks extra tools. Rejected: it mixes channels in one process, and a bug in a canary vertical could take the public server down.

**3. Internal-only by secret path.** With `ASKRIGHTO_MCP_PATH_TOKEN` set, MCP is served only at `/mcp/<token>` (at least 32 random bytes, base64url); `/mcp` and wrong tokens return 404, not 401, so the endpoint's existence is not confirmed. The access log records the path as `/mcp/***`. `/healthz` stays open for the playbook; `/readyz` and `/metrics` also need the token. Responses carry `X-Robots-Tag: noindex`. The token lives in ansible-vault and is rotated when a tester leaves or at least every 90 days; rotation is a redeploy. Alternatives:
- Cloudflare Access with service tokens. Rejected for now: custom connectors in Claude and ChatGPT cannot send the headers.
- OAuth through Cloudflare Access or our own provider. Deferred: correct, but heavy for a handful of testers; revisit when the tester group grows or a directory review needs auth.
- IP allow-list. Rejected: requests come from the hosts' clouds, not from testers.

A secret URL is a shared key; it is acceptable here because the canary serves only public reference data and is read-only, so a leak exposes unfinished answers, not private data.

**4. Same database and schema, additive migrations only.** Both instances use the `askrighto` schema. The canary's migrations may add tables and columns but never change or drop what an older image reads. Production checks that the schema version is at least the one it needs, not exactly it, so a canary ahead by additive migrations is safe. A migration that is not additive needs its own plan and Iven's go before the canary runs it. Course loads (`courses:load`, `vce:load`) run from the canary container. Alternative: a separate `askrighto_canary` schema. Rejected: it doubles energy syncs against retailers' limits and the course data is public reference data anyway; the app already accepts schemas named `askrighto_*` if this changes later.

**5. Rights gate treats the canary as production.** `ASKRIGHTO_ENV=production` on both instances, so `pending` datasets (for example VTAC scaling) stay `data_unavailable` on the canary too. Testers are real people outside the dev machine; serving uncleared data to them is distribution. Development copies stay on developer machines.

**6. Outcome counters, metadata only.** The canary counts, per tool: `curated`, `index_only`, `cannot_check`, `not_in_dataset`, `data_unavailable`, `needs_input`, plus latency buckets. Counters live in memory, are exposed at `/metrics/<token>` in Prometheus text form, and reset on restart. No arguments, course ids, results, IPs or session ids are recorded. Alternative: log course ids to see which courses are asked about. Rejected: per-request content logging breaks rule 3; curation priorities come from testers' reports and the gap report instead. Production may enable the same counters later.

**7. Testers.** Iven and named adults only (ChatGPT allows 13 to 17 year olds, and the Children's Online Privacy Code applies from 10 Dec 2026; the canary does not need that review if no minors use it). The canary URL is shared directly, never in the repo, docs, plugin bundles or directory submissions. A short tester note explains that answers may be incomplete and how to report problems.

**8. Promotion gates.** A vertical moves to the public server's `ASKRIGHTO_VERTICALS` only when all hold, recorded in the promotion pull request:
1. Rights register entries for its datasets are `cleared`; no `cleared_pending_legal_view` remains (legal view done).
2. Review-by dates are current.
3. The vertical's launch criteria are met (for courses: the agreed curation depth, and the guided-browsing test prompts passing in Claude and ChatGPT).
4. Canary counters over at least two weeks show no unexplained `data_unavailable` or error spikes.
5. Iven's explicit go in writing.

Promotion is a vars change and redeploy; rollback is the reverse. Neither needs a code change.

**9. Health and readiness per vertical.** `/readyz` reports each enabled vertical's readiness separately, so the canary can be ready for energy while courses still wait for their first load, and the playbook health check uses `/healthz` only.

## How results carry source and as-of date

Unchanged. Every tool result on either instance is built by the same tool code through `found` or `notFound`; the flag decides only which tools exist. Counters never touch results.

## Risks / Trade-offs

- [The secret URL leaks] → Read-only public data only; rotate the token and redeploy; move to OAuth if it happens twice or the group grows.
- [Canary migration breaks production] → Additive-only rule, production's "at least" schema check, and a test that runs production's image against the canary's latest schema in CI.
- [Two instances double the energy sync load on retailers] → Only one instance runs the energy sync job: the scheduled job registers only where `ASKRIGHTO_SYNC=on` (production). The advisory lock already prevents overlap.
- [Testers' hosts cache an old tool list after a canary redeploy] → Tester note: reconnect the connector after an announced update.
- [Canary drifts into a de facto public service] → No listing, no docs, no-index, token rotation, and the promotion gates as the only way out.

## Open Questions

- Which testers, beyond Iven, should get the canary URL.
- Whether to put production behind OAuth too before the directories open, which would make the canary's gate the same mechanism.
