# Proposal

## Why

Uni course research is the first vertical with questions that only real use will answer. How deep must curation go before guided browsing is good enough? Do host browser agents read course pages reliably? Do the facts we re-key in our own words survive a legal view? Iven wants it internal-only for now (16 Nov 2026), as a canary, while energy carries on toward public listing on the same server.

Today the server has one MCP route (`/mcp` on `askrighto.feimacode.com`, later `askrighto.com.au`), and every registered tool is visible to anyone who connects. Directory reviewers, and later the public, would see half-finished course tools as soon as they are merged. We need named testers to reach a vertical that the public route does not show, and a clear bar it must clear before the public route serves it.

Iven, 16 Nov 2026: use the same instance with an internal-only route rather than a second deployment. One container, one sync, one deploy, and no infra change beyond two settings.

## What Changes

- Add **vertical flags** with two lists:
  - `ASKRIGHTO_VERTICALS` names the verticals the process loads (data modules, readiness checks, jobs), for example `energy,courses`.
  - `ASKRIGHTO_PUBLIC_VERTICALS` names those the public route serves, for example `energy`. It must be a subset of the loaded list. An unknown name stops start-up.
- Add an **internal route**, `/mcp-internal/<token>`, on the same instance. It serves every loaded vertical. The public `/mcp` serves only the public list. Each request builds its MCP server with the tools and instructions of its route's verticals, so a public client never sees a course tool, even in `tools/list`.
- Keep the internal route **private**:
  - The token (`ASKRIGHTO_INTERNAL_TOKEN`) lives in ansible-vault and is rotated.
  - A plain `/mcp-internal` or a wrong token returns 404.
  - The token is masked in the access log, and responses carry no-index headers.
  - The route is off entirely when no token is set.
  - The URL never appears in a listing, plugin bundle or public doc.
- **Isolate the public route from internal-only verticals:**
  - A vertical that only the internal route serves may fail to start without stopping the server. The internal route then reports it unavailable, and `/mcp` keeps working.
  - Public `/readyz` reflects public verticals only.
  - Internal-only verticals' queries run under a statement timeout.
- Add **metadata-only outcome counts** per tool and route: how often a result was curated, index-only, could not be checked, not found, unavailable or needed input, plus latency. No arguments, results or identities are recorded, so rule 3 (stateless for users) holds.
- Define **promotion gates** a vertical must pass before it joins the public list:
  - the legal view is done, with no `cleared_pending_legal_view` entries left;
  - the rights register is current;
  - the vertical's launch criteria are met;
  - two weeks of internal counts show nothing unexplained;
  - Iven gives an explicit go.

  Promotion is adding the vertical to `ASKRIGHTO_PUBLIC_VERTICALS` and redeploying; rollback is removing it.
- Use the same path for later verticals: health cover starts internal too.

Data source: none new. This change governs how datasets are exposed. The data rights gate from `add-course-data-permissions` applies to both routes in production; the internal route is not a development environment.

Hosts affected: none publicly. Named testers add the internal URL as a custom connector in Claude and ChatGPT developer mode (or use Claude Code or MCP Inspector). The public route, and anything listed in the Claude, ChatGPT or Gemini directories, serves energy only until courses are promoted.

Out of scope:

- User accounts, OAuth or per-tester identity. The secret path is a shared key; OAuth is a later option if the tester group grows.
- A separate canary deployment for trialling new images. Every deploy reaches both routes at once; the route split is per vertical, not per build.
- Traffic splitting or A/B tests on the public route.

## Capabilities

### New Capabilities

- `release-channels`: which verticals the process loads and which each route serves, how the internal route is kept private and isolated from the public one, what may be counted, and the gates a vertical passes to reach the public route.

### Modified Capabilities

None.

## Impact

- New code: `src/verticals.ts` (flag parsing and a registry in which each vertical registers its tools, datasets, readiness checks, instructions and jobs), route-aware server creation in `src/server/create-server.ts`, the internal route and token handling in the HTTP layer, and outcome counters at `/metrics-internal/<token>`.
- Changes: `src/tools/index.ts` and `src/server/instructions.ts` read from the registry per route instead of a fixed list; energy becomes the first registered vertical with no behaviour change on `/mcp`.
- Infra (feima-infra, done there; small): set `ASKRIGHTO_VERTICALS`, `ASKRIGHTO_PUBLIC_VERTICALS` and a vault secret for `ASKRIGHTO_INTERNAL_TOKEN` in the existing `askrighto` role. No new container, route or DNS record.
- Docs: `docs/deploying.md` gains an internal route and promotion section, and `docs/architecture.md` gains release channels.
- The course changes (`add-vic-course-data`, `add-vce-admissions-data`, `add-vic-course-tools`) load in production but are served on the internal route only, until promoted.
