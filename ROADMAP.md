# Ask Righto roadmap

Everyday Aussie decisions, backed by public data. askrighto.com.au

Last updated: 13 November 2026. This file collects every recommendation made so far in the
project's research. Each item names where it came from and, for build work, the OpenSpec
change id to propose it under (`/openspec-propose <change-id>`).

Sources:

- **[F]** Feasibility analysis, 11 Nov 2026: Conditional Go.
  https://claude.ai/artifact/StoXPvWCFuapBcq5Fv59DM
- **[D]** Local life areas with open data, 11 Nov 2026.
  https://claude.ai/artifact/ELqyA7rFeNB7FfQXRqsuLo
- **[R]** Uni course data: can we use it?, 12 Nov 2026 (includes the 20-course live lookup test).
  https://claude.ai/artifact/XRPC7qqi7ssJ3RBHK2FDXM
- **[N]** Naming thread, 12 to 13 Nov 2026: Ask Righto chosen.
- **[I]** `feimacode/inkview` repo (UI layer and deploy pattern), read 13 Nov 2026.

None of the research is legal advice. Items marked "legal view" need a lawyer before launch.

---

## Guiding decisions

These apply to every phase. They are also written into `openspec/config.yaml`, so every
proposal is checked against them.

| Decision | Why | Source |
| --- | --- | --- |
| One hosted, stateless remote MCP server, packaged three ways | All three directories accept a remote MCP server over HTTPS; one tool schema means one set of reviews to keep up | F |
| Every fact comes from a tool result with source URL, as-of date and explicit not-found | AI trust is the main objection users raise; hosts' models must quote, not invent | F, previous pilot |
| Open data only: CC BY, CDR product data, or written permission. No purchased data | Iven, 12 Nov 2026 | D |
| No scraping of sites whose terms ban it (VTAC, UAC, QTAC, TISC, Energy Made Easy site, privatehealth.gov.au site) | Terms forbid extraction or commercial use | D, R |
| Course facts are written in our own words with a link to the official page | No admissions centre offers an open licence | R |
| No accounts, stored conversations or profiles | Claude directory rule; ChatGPT allows 13 to 17 year olds; Children's Online Privacy Code binds from 10 Dec 2026 | F |
| No ads, sponsored content or paid placement in any host app; the pilot is a demand test | Claude and OpenAI both ban them; any paid tier lives on askrighto.com.au with external checkout | F |
| Factual comparison only; no general insurance or credit comparison without a legal view or licensed partner | Comparing them can be financial advice needing an AFSL or credit licence; ASIC sued Choosi in 2025 | F, D |
| Tools are read-only, with `title`, `readOnlyHint`, `destructiveHint`, `openWorldHint`, verb-first names and flat schemas | Design for the strictest host rules (OpenAI hints, Google flat schemas) | F |
| UI through Inkview components, deploy the way Inkview deploys | Iven, 12 Nov 2026 | I |

---

## Phase 0: Foundations (now)

### Project setup (done)

- [x] Repo initialised with OpenSpec (`openspec/`, Claude Code and Codex skills)
- [x] Project context and rules in `openspec/config.yaml`
- [x] `AGENTS.md` / `CLAUDE.md` working rules
- [x] This roadmap

### Admin and accounts (Iven)

- [ ] Register askrighto.com.au [N]
- [ ] Submit ASKRIGHTO to ASIC for manual business name review; if rejected, reopen naming [N]
- [ ] Trade mark search for sound-alikes ("Right-O", "Rightoh", "Ask Right") [N]
- [ ] Search the Claude, ChatGPT and Gemini directories for existing "Righto" apps [N]
- [ ] Complete OpenAI Platform identity verification (needed to publish a ChatGPT plugin) [F]
- [ ] Apply for the Google Connected Apps preview now; reported US developers only so far [F]
- [ ] Check in each console whether ChatGPT plugins and Google Connected Apps reach Australian users [F]
- [ ] Later, if the pilot goes well: file an Ask Righto trade mark in classes 9 and 42 with a trade mark attorney [N]

### Data permissions and legal views (Iven, can run in parallel)

- [ ] Ask VTAC, then UAC, for written permission to reuse course facts (drafts can be prepared on request; nothing has been sent) [R]
- [ ] Check VCAA terms for the scaling and school availability data the previous pilot ingested [F]
- [ ] Legal view: private health insurance comparison as factual information, and any referral revenue [F, D]
- [ ] Legal view: obligations for energy plan comparison (accuracy, commission disclosure). Now first in line, since energy is Phase 1 [D]

---

## Phase 1: MCP server core and energy plan comparison

Goal: a working Ask Righto server that compares electricity and gas plans for an Australian
household, running in Claude and ChatGPT developer mode. Energy goes first (Iven, 13 Nov 2026):
its data is open under the Consumer Data Right, no licence is needed to compare, and it has no
data rights problem to clear first.

### Server core

| Item | Detail | Change id |
| --- | --- | --- |
| Server skeleton | TypeScript remote MCP server over HTTP (`/mcp`, `/healthz`), stateless, rate limited, access log without arguments, following Inkview's server shape [I] | `add-mcp-server-core` |
| Grounded result envelope | Every tool returns the value, `source` (name, URL), `asOf` date, and an explicit `found: false` instead of a guess [F] | `add-mcp-server-core` |
| Host guidance skill | A short skill that tells the host model to quote only tool results and show sources [F] | `add-host-guidance` |
| Tests | Unit tests for the engine, an MCP smoke test, and tests that every tool returns `source` and `asOf` | each change |

### Energy plans

The three changes below are proposed in `openspec/changes/` and wait for review. Build order:
`add-mcp-server-core`, then `add-energy-plan-data`, then `add-energy-plan-tools`.

| Item | Detail | Change id |
| --- | --- | --- |
| Data | AER energy product reference data (CDR APIs, no auth), covering Energy Made Easy and Victorian Energy Compare plans. CDR Rule 2.6 says data holders cannot restrict use. Use the API only; the Energy Made Easy site bans scraping and commercial use [D] | `add-energy-plan-data` |
| Storage | Shared Azure PostgreSQL under its own `askrighto` schema (Iven, 13 Nov 2026), with versioned SQL migrations; `feimacode/feima-api` is the reference for conventions. Holds public plan data only, so the stateless-for-users rule still holds | `add-energy-plan-data` |
| Delta sync and rate limits | Daily list pass, detail only for changed plans, rolling weekly re-check, 5 requests a second cap, overnight run. No AER rate limit or SLA is published; write to the AER before launch [D] | `add-energy-plan-data` |
| Plan model | Plan data is messy (about 1,700 distinct plan shapes per community research); model tariffs carefully and test against prior art (Rewiring Australia, Plaintext-Lab) [D] | `add-energy-plan-data` |
| Tools and widgets | Estimate a bill from usage and compare plans, with source and as-of date | `add-energy-plan-tools` |
| Scope of the first release | Electricity first, then gas. Inputs: postcode or distributor, usage (kWh or a bill), solar and controlled load. Output: estimated yearly cost per plan, with the plan link, source and as-of date. Factual comparison only: no switching, no commissions | `add-energy-plan-tools` |
| Legal view | Obligations for energy plan comparison (accuracy, commission disclosure). No licence requirement turned up, but nobody has given a legal view yet [D] | — |
| Checks before building | Confirm Rule 2.6 is unchanged in the current CDR Rules (only the Feb 2020 version was read); live-test the APIs (the research container's network blocked them) [D] | — |

---

## Phase 2: Deploy and list on Claude and ChatGPT

| Item | Detail | Change id |
| --- | --- | --- |
| Container image | Dockerfile, GitHub Actions workflow pushing `ghcr.io/feimacode/askrighto:latest` and `:sha-<commit>` on `main`, and `:<version>` on `v*` tags, with a `/healthz` smoke test, as Inkview does [I] | `add-deploy-pipeline` |
| Hosting | Run the image on the shared feimacode Azure VM behind Traefik and Cloudflare, through an Ansible role in `feimacode/feima-infra`, as Inkview does. That infra repo has not been read yet [I] | `add-deploy-pipeline` |
| Domain | Serve `https://askrighto.com.au/mcp` (or an `mcp.` subdomain); privacy page and terms on the site [F, N] | `add-deploy-pipeline` |
| Claude directory | Two listings, paired: the MCP connector, plus a plugin bundle (skills, MCP reference) from this public GitHub repo with a `.claude-plugin/marketplace.json`, as Inkview does. 3 to 5 PNG screenshots. No auth for public data. Note: MCPB desktop extensions are no longer accepted in the directory [F, I] | `add-claude-listing` |
| ChatGPT plugin | Plugin ZIP (`plugin.json`, `mcp.json`, skills) pointing at the server. Five positive and three negative test cases, a video walkthrough, policy attestations, then a separate Publish step. Must suit 13 to 17 year olds [F] | `add-chatgpt-listing` |
| Privacy page | What the server logs (no arguments or results), no accounts, no storage. Children's Online Privacy Code check before 10 Dec 2026 [F] | `add-claude-listing` |

---

## Phase 3: Gemini

| Item | Detail | Change id |
| --- | --- | --- |
| Google Connected Apps | Register the same server in Google Connected Console once the preview admits us. MCP Apps resources up to 15 MB; external scripts need SRI hashes; missing annotations are treated as destructive [F] | `add-gemini-listing` |

---

## Phase 4: Uni course choice for VIC (VCE)

Goal: help a VCE student or parent find uni courses that fit. Estimate: 3 to 5 weeks part-time
for a VIC-only server (judgement from the code reviewed, not measured) [F]. The server core from
Phase 1 is reused.

| Item | Detail | Change id |
| --- | --- | --- |
| Port the recommendation engine | From `vce-subject-planner/apps/api/src/recommendation/`: intake, prerequisites, candidates, ranking, preference list, offer rounds, SEAS, early entry. Pure functions become MCP tools nearly one to one [F] | `add-vic-course-tools` |
| Port the tool schemas | Convert `tools.ts` OpenAI function schemas to MCP tools with annotations; drop the in-app LLM call, since the host model narrates [F] | `add-vic-course-tools` |
| VIC course fact store | Rebuild course ATARs and prerequisites as our own-worded facts with official links, using the hand-built `vic-university-atar-catalog.csv` pattern. Do not ship the scraped VTAC CSV. University PDF course guides (Monash, Sydney) were the cleanest source in testing [R] | `add-vic-course-data` |
| CRICOS as course list lead | CRICOS on data.gov.au (CC BY) for course names, providers and campuses. Misses domestic-only courses and has no ATARs. The dataset file itself is not yet tested [R] | `add-vic-course-data` |
| Normalise ATAR labels | Unis publish lowest ATAR, lowest selection rank, guaranteed ATAR or entry threshold, for different years. Store the label and year with each figure [R] | `add-vic-course-data` |
| Live lookup fallback | For courses not in the store: give the host the official page link, let the host's own web search read it, always with the source link and a "check the official page" note. Live lookup alone answered only 7 of 20 test courses fully, so it is a fallback, not the main source [R] | `add-course-live-lookup` |
| Data refresh | Re-key facts each admissions year; record the as-of date. Reuse the previous pilot's Python ingesters only where the source licence allows | `add-vic-course-data` |
| Inkview widgets | Render a course shortlist and a course comparison with `@feimacode/inkview-sdk` (`registerInkview`, `inkview.table`, `inkview.comparison`), with a markdown fallback for text-only hosts [I] | `add-course-widgets` |

---

## Phase 5: Uni course choice for NSW (HSC) and QLD (QCE)

| Item | Detail | Change id |
| --- | --- | --- |
| NSW and QLD course fact stores | Same own-worded, linked pattern as VIC, built from university guides and course pages. The pilot's UAC and QTAC CSVs are scraped, lack ATARs, and must not ship [F, R] | `add-nsw-course-data`, `add-qld-course-data` |
| State subject rules | NSW HSC and QLD QCAA subject rules and ATAR calculation; scaling differs by state | `add-nsw-course-data`, `add-qld-course-data` |
| UAC permission | Ask UAC for written permission in parallel [R] | — |

Multi-state content work is the main effort driver; the earlier study put national coverage at
6 to 12 months [F].

---

## Phase 6: Private health insurance comparison

| Item | Detail | Change id |
| --- | --- | --- |
| Data | PrivateHealth.gov.au dataset on data.gov.au, CC BY 3.0 AU, monthly ZIP (latest September 2026). Use the dataset, not the site, whose terms forbid framing or using it to sell [D] | `add-health-cover-data` |
| Tools | Filter and rank policies by stated cover, excess and premium: factual comparison, not a recommendation [F] | `add-health-cover-tools` |
| Widgets | Cover comparison table through Inkview [F, I] | `add-health-cover-tools` |
| Compliance | Claude lists insurance as high risk: human-in-the-loop and direct disclosure to consumers; health data flag on submission; no binding or purchase in-app [F] | `add-health-cover-tools` |
| Gate | Legal view from Phase 0 before public listing | — |

---

## Phase 7: Fuel prices

| Item | Detail | Change id |
| --- | --- | --- |
| VIC | Servo Saver Public API, CC BY 4.0, apply for a key, 24-hour delay, mandatory notice "© State of Victoria accessed via the Victorian Government Service Victoria Platform" [D] | `add-fuel-prices-vic` |
| QLD | Confirm the licence on data.qld.gov.au (data.gov.au shows "Not Specified") [D] | `add-fuel-prices-qld` |
| NSW, TAS | Ask API NSW whether the free tier allows commercial use [D] | — |
| WA | Excluded: FuelWatch reserves all rights [D] | — |
| Widgets | Inkview map and listings for nearby servos [I] | `add-fuel-prices-vic` |

---

## Parked (not in the pilot)

| Area | Why parked | What would unblock it | Source |
| --- | --- | --- | --- |
| Bank savings, term deposit and home loan rates | Data is open via CDR, but comparing credit products may need an ACL or AFSL | Legal view | D |
| Car, home and travel insurance | Financial product; comparison can be general advice needing an AFSL; no open price data | Licensed partner and a data feed | F |
| Childcare centres, ratings and fees | ACECQA and Starting Blocks terms: non-commercial only | Written permission | D |
| School comparison | ACARA My School terms bar commercial comparison lists | Written permission | D |
| NSW property sales | Free download is CC BY-NC-ND | Paid licence (out: no purchased data) | D |
| GP and health service finder | Healthdirect NHSD API for approved partners only | Partnership | D |
| NSW rental bond data ("is this rent fair?") | Page states no licence | Confirm licence | D |

---

## Decisions made

- **Energy plans are the first vertical** (Iven, 13 Nov 2026), ahead of uni course choice. Health insurance and fuel follow the course phases.
- **The repo is public** (Iven, 13 Nov 2026), so the Claude plugin bundle can ship from it.

## Open decisions for Iven

1. **Revenue:** run the pilot as a demand test with no revenue, or plan a paid tier on
   askrighto.com.au from the start [F].

## Not yet read

- `feimacode/feima-infra` (the Ansible role and VM setup Inkview deploys with). Needed before Phase 2.
