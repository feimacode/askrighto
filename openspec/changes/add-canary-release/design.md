# Design

## Context

- One image (`ghcr.io/feimacode/askrighto`) is run by the `askrighto` Ansible role in feimacode/feima-infra on the shared Australia East VM, behind Traefik and Cloudflare, at `askrighto.feimacode.com` (internal test domain; `askrighto.com.au` later). Migrations are embedded and additive (`docs/deploying.md`).
- The server is stateless and already creates one MCP server per request (`src/server/create-server.ts`). Tools are a fixed list in `src/tools/index.ts`; instructions are a base text plus `addInstructions`; datasets register with `src/core/registry.ts`; `/healthz` and `/readyz` exist.
- Claude and ChatGPT connect to remote MCP servers from their own clouds, so an IP allow-list cannot single out our testers. Their custom connectors take a URL and optionally OAuth, not custom headers.
- Iven, 16 Nov 2026: courses internal-only for now, as a canary, on the same instance behind an internal route rather than a second deployment.

## Goals / Non-Goals

**Goals:**

- Named testers reach a vertical that the public route never shows.
- One setting to promote or roll back a vertical.
- A fault in an internal-only vertical does not take the public route down.
- Learn from internal use (coverage, how often answers are index-only) without breaking statelessness.

**Non-Goals:**

- Strong per-user authentication.
- Trialling new builds before the public route gets them.

## Decisions

**1. Two lists: loaded and public.** `ASKRIGHTO_VERTICALS` (default `energy`) names what the process loads; `ASKRIGHTO_PUBLIC_VERTICALS` (default: same as loaded) names what `/mcp` serves. Start-up fails on an unknown name, an empty list, or a public vertical that is not loaded. Each vertical module exports `register(ctx)` adding its tools, datasets, readiness checks, instructions and jobs, tagged with the vertical id.

**2. Route decides the tool set.** `/mcp` builds its per-request server from the public verticals; `/mcp-internal/<token>` builds it from all loaded verticals. `tools/list`, `tools/call` and `initialize` instructions all come from that set, so a public client cannot call a course tool even by name. `list_data_sources` on `/mcp` lists only public verticals' datasets. Alternative: one tool list with a per-request "hidden" flag. Rejected: hidden tools could still be called by name, and their instructions would leak into `initialize`. Alternative: a second container (the first draft of this change). Rejected (Iven): a second deployment, infra change and migration-compatibility rule for a handful of testers is more than the risk warrants.

**3. Private by token in the path.** `ASKRIGHTO_INTERNAL_TOKEN` (at least 32 random bytes, base64url). With no token set, the internal route does not exist. `/mcp-internal` and wrong tokens return 404, not 401, so the route's existence is not confirmed. Tokens are compared in constant time. The access log writes `/mcp-internal/***`. Internal responses carry `X-Robots-Tag: noindex`. The token lives in ansible-vault and is rotated when a tester leaves or at least every 90 days (a redeploy). Alternatives:
- Header token or Cloudflare Access service tokens. Rejected: Claude and ChatGPT custom connectors cannot send them.
- OAuth. Deferred until the tester group grows or a review needs auth.
- A plain `/mcp-internal` with no token. Rejected: a guessable path is public.

A secret URL is a shared key. It is acceptable because the route is read-only over public reference data, so a leak exposes unfinished answers, not private data.

**4. Isolation inside one process.** The cost of sharing a process is that an internal-only vertical can hurt the public route. Mitigations:
- **Start-up:** an internal-only vertical whose `register` throws, or whose tables are missing, is marked failed. Its tools answer `data_unavailable` on the internal route; the server still starts. A failing public vertical still stops start-up, as today.
- **Readiness:** `/readyz` reflects public verticals only; `/readyz-internal/<token>` reports every loaded vertical separately.
- **Database:** internal-only verticals' queries run with a statement timeout (2 seconds) and the pool stays at its current size. A slow course query cannot hold a connection the energy tools need for long.
- **Errors:** a thrown error inside a tool already becomes a tool error for that request only; nothing is shared between requests.

**5. Rights rules are production on both routes.** With `ASKRIGHTO_ENV=production`, `pending` datasets (for example VTAC scaling) stay `data_unavailable` on the internal route too. Testers are real people outside a developer's machine; serving uncleared data to them would be distribution.

**6. Outcome counters, metadata only.** Per tool and route: `curated`, `index_only`, `cannot_check`, `not_in_dataset`, `data_unavailable`, `needs_input`, plus latency buckets. Counts are kept in memory, exposed at `/metrics-internal/<token>` in Prometheus text form, and reset on restart. No arguments, course ids, results, IPs or session ids are kept. Alternative: log course ids to learn what testers ask about. Rejected: per-request content logging breaks rule 3; curation priorities come from testers' reports and the gap report.

**7. Testers.** Iven and named adults only. ChatGPT allows 13 to 17 year olds and the Children's Online Privacy Code applies from 10 Dec 2026, which the internal route avoids by having no minors. The URL is shared directly and never put in the repo, docs, plugin bundles or listing material. A short tester note says answers may be incomplete, to reconnect after an announced update, and how to report problems.

**8. Promotion gates.** A vertical joins `ASKRIGHTO_PUBLIC_VERTICALS` only through a pull request (or infra change) that records all of:
1. Rights entries for its datasets are `cleared`, with no `cleared_pending_legal_view` left (legal view done).
2. Review-by dates are current.
3. Its launch criteria are met (for courses: the agreed curation depth, and the host test prompts passing in Claude and ChatGPT, including guided browsing).
4. Two weeks of internal counters show no unexplained `data_unavailable` or error spikes.
5. Iven's explicit go in writing.

Rollback is removing it from the list and redeploying; neither step changes code.

## How results carry source and as-of date

Unchanged. Both routes run the same tool code through `found` or `notFound`; the route only decides which tools exist. Counters never touch results.

## Risks / Trade-offs

- [An internal-only vertical crashes or slows the shared process] → Isolation in decision 4, tests that a failed course module leaves `/mcp` working, and the option to drop `courses` from `ASKRIGHTO_VERTICALS` with one redeploy.
- [Every deploy ships course code to the public process, even unpromoted] → It is loaded but unreachable from `/mcp`; a test asserts the public `tools/list` and `initialize` hold nothing from internal-only verticals.
- [The secret URL leaks] → Read-only public data; rotate the token; move to OAuth if it happens twice or the group grows.
- [Testers' hosts cache an old tool list after a redeploy] → The tester note asks them to reconnect after an announced update.
- [The internal route drifts into a de facto public service] → No listing, no docs, no-index, token rotation, and the promotion gates as the only way out.

## Open Questions

- Which testers, beyond Iven, get the internal URL.
- Whether to put the public route behind OAuth before the directories open, which would let the internal route use the same mechanism.
