# Ask Righto roadmap

Everyday Aussie decisions, backed by public data. askrighto.com.au

Last updated: 15 November 2026. This file collects every recommendation made so far in the
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
- **[S]** Case scoring, 15 Nov 2026 (Iven's direction: pick complex cases that need aggregated
  data and are common to a large audience). Data sources named only in [S] are from desk
  knowledge and have **not** been checked for licence or access yet.

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
| Choose cases that are complex, need aggregated data and reach a large audience; skip single-lookup tasks | A host model with web search already handles simple lookups | Iven, 15 Nov 2026; S |

---

## How we pick cases

Iven, 15 Nov 2026: the best cases are **complex** and **need aggregated data**. A host model
with web search already answers simple lookups well, and single-source price apps already exist.
Ask Righto earns its place where the answer needs many publishers' data joined, normalised and
run through a calculation the person cannot easily do alone. That is also where a grounded,
sourced answer matters most.

Each case is scored 1 to 5 on three criteria:

- **Complexity (Cx):** how many interacting variables, rules and calculations the decision
  needs. 5 means a computed model (tariffs against usage, tax thresholds against income);
  1 means a single lookup.
- **Aggregated data (Agg):** how many publishers or datasets must be combined and normalised.
  5 means dozens of publishers or several joined datasets; 1 means one source that already
  presents the answer well.
- **Audience (Aud):** how many Australian households face the decision, and how often.
  5 means nearly every household every year.

Data and regulatory status are **gates**, not scores: a high score does not help if the data
is closed or the comparison needs a licence. Scores are judgement, not measured.

### Scoring table

| # | Case | Cx | Agg | Aud | Total | Data gate | Regulatory gate | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Energy plans (electricity and gas) | 5 | 5 | 5 | **15** | Open: CDR product data, live | Legal view (accuracy, disclosure) | Building, Phase 1 |
| 2 | Private health insurance, with rebate, MLS and LHC maths | 5 | 5 | 4 | **14** | Open: CC BY 3.0 AU monthly file | Legal view before listing; Claude high-risk category | Phase 5 |
| 3 | Bank savings, term deposits, home loans | 4 | 5 | 5 | **14** | Open: CDR product data | ACL/AFSL question | Parked |
| 4 | Uni course research (VCE first) | 5 | 5 | 3 | **13** | No TAC licence; own-worded store | VTAC/UAC permission requested in Phase 0 | **Next**: VIC Phase 4, NSW/QLD Phase 6 |
| 5 | Home solar and battery payback | 5 | 4 | 3 | **12** | Reuses CDR plans; solar yield and rebate data to check | None known; no installer referrals | Candidate, Phase 7 |
| 6 | Aged care: providers and fee estimate | 5 | 4 | 3 | **12** | Star Ratings and provider data, licence to check | None known; estimates must defer to Services Australia | Candidate, research first |
| 7 | Suburb fit for renters and movers | 3 | 5 | 4 | **12** | Many state datasets, licences vary; My School excluded | None known | Candidate, research first |
| 8 | Mobile and NBN plans | 3 | 4 | 5 | 12 | Blocked: no open plan data (CDR telco rollout paused, to verify) | None known | Blocked |
| 9 | EV versus petrol running cost | 4 | 4 | 3 | 11 | Green Vehicle Guide, fuel, tariffs, rego; licences to check | Stay off novated leases and finance | Later |
| 10 | Concessions and rebates finder | 3 | 4 | 4 | 11 | Scattered government pages; heavy curation | Eligibility wording needs care | Fold into energy and health as extensions |
| 11 | First home buyer grants and stamp duty | 4 | 3 | 3 | 10 | State revenue office rules, curated | Stay off loans (ACL) | Later |
| 12 | Childcare out-of-pocket (CCS) | 4 | 2 | 3 | 9 | CCS rates public; centre fees blocked (Starting Blocks terms) | None known | Later; weak without fee data |
| 13 | Fuel prices | 1 | 3 | 5 | 9 | VIC open; QLD, NSW unclear; WA closed | None | **Demoted**: input to case 9 only |

Notes on the new candidates [S]:

- **Solar and battery payback.** Combines the energy plan store (feed-in tariffs, time-of-use
  rates) with solar yield by location, system and battery prices, and the federal Cheaper Home
  Batteries discount plus state rebates. Most of the hard work (tariff model, bill estimator)
  already exists in the energy vertical, so this is the cheapest high-scoring addition.
- **Aged care.** Families comparing home care and residential providers face means-tested
  fees under the new Aged Care Act (from 1 Nov 2025), Support at Home, and provider Star
  Ratings. Very complex and high stakes; data licence and fee-rule sources need a research
  thread before a proposal.
- **Suburb fit.** Joins census (ABS, CC BY), rents (state bond data where licensed), school
  zones (VIC and NSW publish zone data), public transport (GTFS) and crime statistics. Highest
  data-integration effort of the set, and licences vary by state.
- **Fuel.** Low complexity, and state apps, PetrolSpy and host web search already answer it.
  Its open VIC feed is still useful as an input to the EV versus petrol case.

### Recommended order

1. **Energy plans** (Phase 1, building). Finish the GST basis, full retailer list and live
   host tests before anything new starts.
2. **Uni course research, VIC first** (Phase 4, next build; Iven, 15 Nov 2026). Reuses the
   pilot's engine. Aim to be live by July 2027, ahead of mid-year subject selection and VTAC
   preferences opening in August. Send the data permission requests now, since replies take time.
3. **Private health insurance** (Phase 5). Same shape as energy: a monthly open file, then a
   calculation (premium after rebate, MLS break-even, LHC loading). No permission to wait for,
   and demand runs all year with peaks before the 1 April premium rise and at tax time. Public
   listing waits for the legal view. NSW and QLD courses (Phase 6) follow, since multi-state
   content is the larger job.
4. **Solar and battery payback** (Phase 7). An energy extension that reuses the plan store and
   estimator, so it can move earlier if courses stall on data permission.
5. **Aged care, then suburb fit.** Research threads first (data licences, rule sources), then
   proposals. Neither has a confirmed open data path yet.

Banking stays parked until a legal view; mobile and NBN plans stay blocked until open plan data
exists.

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

- [ ] Ask Course Seeker, VTAC, then UAC, for written permission to reuse course facts and VTAC scaling data (drafts are a task in `add-course-data-permissions`; nothing has been sent) [R]
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
| Delta sync and rate limits | Daily list pass, detail only for changed plans, rolling weekly re-check, a per-retailer rate cap (2 a second, one in flight each) because retailers set their own limits behind the AER's routing host, overnight run. No limit or SLA is published; one retailer is known to allow 10 a second [D] | `add-energy-plan-data` |
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

## Phase 4: Uni course research for VIC (VCE)

The next build after energy (Iven, 15 Nov 2026).

Goal: help a VCE student or parent find uni courses that fit. Aim to be live by July 2027, ahead of
mid-year subject selection and VTAC preferences opening in August. Estimate: 3 to 5 weeks part-time
for a VIC-only server (judgement from the code reviewed, not measured) [F]. The server core from
Phase 1 is reused.

The four changes below are proposed in `openspec/changes/` and wait for review (15 Nov 2026). Build
order: `add-course-data-permissions` (start now: the permission requests have the longest lead
time), then `add-vic-course-data`, then `add-vce-admissions-data`, then `add-vic-course-tools`.
The roadmap's earlier `add-course-live-lookup` and `add-course-widgets` items are folded into
`add-vic-course-tools`, as energy folded its widgets into its tools change.

| Item | Detail | Change id |
| --- | --- | --- |
| Data rights register and permissions | A register of every source's reuse basis with evidence; production refuses to serve a dataset whose rights are not cleared; pending data never enters the public repo; drafted requests to Course Seeker, VTAC and VCAA (Iven sends them); a corrections route with a five business day target [R] | `add-course-data-permissions` |
| VIC course fact store | Rebuild course ATARs and prerequisites as our own-worded facts with official links, using the hand-built `vic-university-atar-catalog.csv` pattern, as curated YAML loaded into PostgreSQL. Do not ship the scraped VTAC CSV. University PDF course guides (Monash, Sydney) were the cleanest source in testing [R] | `add-vic-course-data` |
| CRICOS as course list lead | CRICOS on data.gov.au (CC BY) for course names, providers and campuses, as a cross-check and gap report. Misses domestic-only courses and has no ATARs. The dataset file itself is not yet tested [R] | `add-vic-course-data` |
| Normalise ATAR labels | Unis publish lowest ATAR, lowest selection rank, guaranteed ATAR or entry threshold, for different years. Store the kind, intake year and source with each figure [R] | `add-vic-course-data` |
| Structured prerequisites | Prerequisites as rules over VCE studies and minimum study scores, so code can check them; the pilot's prose matching over- and under-matched | `add-vic-course-data` |
| Data refresh | Re-check facts every August (new figures) and March (prerequisites); record the checked date per fact. A page checker flags dead links and copied wording | `add-vic-course-data` |
| Admissions reference data | Key dates (VCAA, VTAC), VTAC preference rules and early entry schemes as own-words facts; the aggregate counting rule ported from the pilot. VTAC scaling and study area groupings are built but held back until VTAC gives written permission | `add-vce-admissions-data` |
| Port the engine and tool schemas | From `vce-subject-planner`: course search, prerequisite check, aggregate, key dates and early entry become eight MCP tools; the in-app LLM call is dropped, since the host model narrates. Subject combination ranking and preference list helpers are not ported yet [F] | `add-vic-course-tools` |
| Live lookup fallback | For courses not in the store: return the official links (university course search, VTAC CourseSearch, Course Seeker) and let the host's own web search read them, always cited and marked as not from Ask Righto. Live lookup alone answered only 7 of 20 test courses fully, so it is a fallback, not the main source [R] | `add-vic-course-tools` |
| Inkview widgets | Course shortlist table, course comparison and course card with `@feimacode/inkview-sdk`, with a markdown fallback for text-only hosts [I] | `add-vic-course-tools` |
| Later | VTAC preference list and offer-round helpers, SEAS, VCAA school subject availability | `add-vtac-preference-tools` and later |

---

## Phase 5: Private health insurance comparison

Follows VIC courses and comes before NSW and QLD courses (Iven, 15 Nov 2026): open data with no
permission to wait for, and the same sync-then-calculate shape as energy.

| Item | Detail | Change id |
| --- | --- | --- |
| Data | PrivateHealth.gov.au dataset on data.gov.au, CC BY 3.0 AU, monthly ZIP (latest September 2026). Use the dataset, not the site, whose terms forbid framing or using it to sell [D] | `add-health-cover-data` |
| Tools | Filter and rank policies by stated cover, excess and premium: factual comparison, not a recommendation [F] | `add-health-cover-tools` |
| Tax maths | Premium after the government rebate by income tier and age, Medicare Levy Surcharge break-even ("is hospital cover cheaper than the surcharge?"), Lifetime Health Cover loading. Thresholds come from published ATO and Department of Health rates with source and as-of date, re-checked each 1 April and 1 July. This calculation is what makes the case complex, not the policy list [S] | `add-health-cover-tools` |
| Widgets | Cover comparison table through Inkview [F, I] | `add-health-cover-tools` |
| Compliance | Claude lists insurance as high risk: human-in-the-loop and direct disclosure to consumers; health data flag on submission; no binding or purchase in-app [F] | `add-health-cover-tools` |
| Gate | Legal view from Phase 0 before public listing | — |

---

## Phase 6: Uni course research for NSW (HSC) and QLD (QCE)

| Item | Detail | Change id |
| --- | --- | --- |
| NSW and QLD course fact stores | Same own-worded, linked pattern as VIC, built from university guides and course pages. The pilot's UAC and QTAC CSVs are scraped, lack ATARs, and must not ship [F, R] | `add-nsw-course-data`, `add-qld-course-data` |
| State subject rules | NSW HSC and QLD QCAA subject rules and ATAR calculation; scaling differs by state | `add-nsw-course-data`, `add-qld-course-data` |
| UAC permission | Ask UAC for written permission in parallel [R] | — |

Multi-state content work is the main effort driver; the earlier study put national coverage at
6 to 12 months [F].

---

## Phase 7: Home solar and battery payback

Candidate from the case scoring [S]. Reuses the energy plan store and bill estimator; propose
only after Phase 1 is live with real prices.

| Item | Detail | Change id |
| --- | --- | --- |
| Inputs | Postcode, roof size or system size, current bill or usage, existing solar, battery size | `add-solar-battery-payback` |
| Data | Feed-in and time-of-use rates from the energy store; solar yield by location; Cheaper Home Batteries discount and state rebates; typical system and battery prices. Every source other than the energy store needs a licence check first | `add-solar-battery-payback` |
| Output | Yearly saving and simple payback per plan, with each figure's source and as-of date. No installer referrals or quotes | `add-solar-battery-payback` |

---

## Candidates needing research first

Scored in "How we pick cases". Each gets a research thread (data licences, rule sources,
prior art) before an OpenSpec proposal.

| Case | What to find out | Suggested change id |
| --- | --- | --- |
| Aged care providers and fee estimate | Licence of Star Ratings and provider data; whether published fee rules (Aged Care Act from 1 Nov 2025, Support at Home) are stable enough to calculate from | `add-aged-care-data` |
| Suburb fit for renters and movers | Licence per state for rents, school zones, crime and transport; which states give enough coverage to launch | `add-suburb-data` |
| EV versus petrol running cost | Green Vehicle Guide licence; rego and charging cost sources. Reuses energy tariffs and the VIC fuel feed below | `add-vehicle-cost` |
| Concessions and rebates | Which energy and health concessions can be stated as rules with sources; offer as extensions of those verticals rather than a standalone case | — |

### Fuel price data (demoted)

Fuel was Phase 7. It is now an input only: a single price lookup is too simple to stand on its
own, and existing apps and host web search already cover it (Iven, 15 Nov 2026). The data
findings stay for the EV case:

- VIC: Servo Saver Public API, CC BY 4.0, apply for a key, 24-hour delay, mandatory notice "© State of Victoria accessed via the Victorian Government Service Victoria Platform" [D]
- QLD: confirm the licence on data.qld.gov.au (data.gov.au shows "Not Specified") [D]
- NSW, TAS: ask API NSW whether the free tier allows commercial use [D]
- WA: excluded, FuelWatch reserves all rights [D]

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
| NSW rental bond data ("is this rent fair?") | Page states no licence | Confirm licence; now also an input to suburb fit | D |
| Mobile and NBN plans | No open plan data; the CDR telco rollout is paused (to verify) | Open plan data | S |
| Super fund comparison | Financial product; AFSL needed | Licensed partner | S |

---

## Decisions made

- **Energy plans are the first vertical** (Iven, 13 Nov 2026), ahead of uni course choice.
- **Pick complex, aggregated-data cases** (Iven, 15 Nov 2026). Order is now energy, VIC uni
  courses (next build), private health insurance, NSW and QLD courses, then solar and battery.
  Health insurance moves ahead of NSW and QLD courses and fuel drops from a phase to a data
  input, changing the 13 Nov order.
- **The repo is public** (Iven, 13 Nov 2026), so the Claude plugin bundle can ship from it.

## Open decisions for Iven

1. **Next research thread:** aged care or suburb fit first [S].
2. **Revenue:** run the pilot as a demand test with no revenue, or plan a paid tier on
   askrighto.com.au from the start [F].

## Not yet read

- `feimacode/feima-infra` (the Ansible role and VM setup Inkview deploys with). Needed before Phase 2.
