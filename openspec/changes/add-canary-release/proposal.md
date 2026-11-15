# Proposal

## Why

Uni course research is the first vertical with unsettled questions that only real use will answer. How deep must curation go before guided browsing is good enough? Do host browser agents read course pages reliably? Do the facts we re-key in our own words survive a legal view? Iven wants it internal-only for now (16 Nov 2026), as a canary, while energy carries on toward public listing on the same server.

Today there is one server and one URL (`askrighto.feimacode.com`, later `askrighto.com.au`), and every registered tool is visible to anyone who connects. Directory reviewers, and later the public, would see half-finished course tools the moment they are merged. We need a way to run a vertical for named testers only, from the same code and image, and a clear bar it must clear before it reaches the public server.

## What Changes

- Add **vertical flags**: `ASKRIGHTO_VERTICALS` lists the verticals an instance serves (for example `energy` or `energy,courses`). A vertical that is not listed registers no tools, datasets, readiness checks, server instructions or scheduled jobs, so the host never sees it. An unknown name stops start-up.
- Add a **canary instance**: a second container from the same image, with its own unlisted hostname (`askrighto-canary.feimacode.com`), the course vertical switched on, and the same database and schema.
- Make the canary **internal-only**. The MCP endpoint answers only on a secret path (`/mcp/<token>`), with the token kept in ansible-vault and rotated. Every other path returns 404. Pages are marked no-index, and the URL is never put in a directory listing, plugin bundle or public doc.
- Keep **migrations compatible** between the two instances: the canary may run ahead of production only with additive migrations, and production keeps working on a schema that is newer than it knows.
- Add **metadata-only outcome counts** on the canary: per tool, how often a result was curated, index-only, not found or unavailable. These count outcomes; they never record arguments, results or who asked, so rule 3 (stateless for users) still holds.
- Define **promotion gates** a vertical must pass before production lists it:
  - the legal view is done, with no `cleared_pending_legal_view` entries left;
  - the rights register is current;
  - the agreed curation depth is met;
  - the host test prompts pass, including guided browsing;
  - Iven gives an explicit go.

  Rolling back is removing the vertical from the flag and redeploying.
- Use the same path for later verticals: health cover starts on the canary too.

Data source: none new. This change governs how existing and planned datasets are exposed. The rights gate from `add-course-data-permissions` treats the canary as production.

Hosts affected: none publicly. Named testers connect Claude and ChatGPT developer mode (and Claude Code or MCP Inspector) to the canary URL. The public server, and anything listed in the Claude, ChatGPT or Gemini directories, keeps serving energy only until courses are promoted.

Out of scope:

- User accounts, OAuth or per-tester identity. The secret path is a shared key; a stronger gate (Cloudflare Access with OAuth for MCP) is a later option if the tester group grows.
- Percentage-based traffic splitting or A/B tests. The canary is a separate URL, not a share of public traffic.
- A separate database or schema for the canary. The course tables hold public reference data and are additive.
- Changes to feima-infra itself, which is a private repo outside this project. This change writes down what the infra role needs; the infra change is made there.

## Capabilities

### New Capabilities

- `release-channels`: which verticals an instance serves, how the internal canary is reached and kept private, how its schema stays compatible with production, what it may count, and the gates a vertical passes to reach the public server.

### Modified Capabilities

None.

## Impact

- New code: `src/verticals.ts` (flag parsing and a vertical registry, each vertical registering its own tools, datasets, readiness checks, instructions and jobs), a secret-path option in the HTTP layer (`ASKRIGHTO_MCP_PATH_TOKEN`), a no-index header option, and outcome counters exposed on a protected `/metrics` path.
- Changes: `src/tools/index.ts` and `src/server/instructions.ts` read from the vertical registry instead of a fixed list; energy becomes the first registered vertical with no behaviour change.
- Infra (feima-infra, done there): a second container (`prod-askrighto-canary`) from the same role with its own vars (`askrighto_verticals`, hostname, image tag, vault token), a Traefik route and a Cloudflare DNS record.
- Docs: `docs/deploying.md` gains a canary section, and `docs/architecture.md` gains release channels.
- Course changes (`add-vic-course-data`, `add-vce-admissions-data`, `add-vic-course-tools`) ship behind the `courses` flag and run on the canary until promoted.
