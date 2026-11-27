# Design

## Principle

Index, do not store. For a licence-heavy or regulated area the server holds a **source index** (where the information lives), **how-to-read facts** (structure, labels, quirks, written in our words), and **skills** (workflow). It holds no figure, rule or product taken from the source. The host agent fetches and reads; the user's agent does the arithmetic. Rule 1 of AGENTS.md already allows facts read by the user's own assistant if quoted with link and time, labelled, and never stored or sent back; this makes that the default for these areas.

## What counts as a source index entry

`{ id, title, publisher, url, kind, readingChecklist[], checkedOn, notes }`, in one reviewed TypeScript or YAML file per area, not in Postgres. `checkedOn` is the day a person confirmed the link loads and is the page meant. `kind` is one of `official_page`, `report_pdf`, `register`, `api_endpoint`, `search_page`. A link checker (`sources:check`) fetches at most one page a second, never writes content, and flags dead links; it replaces `courses:check-pages`.

Every tool result carries `source` (the entry's URL), `asOf` (its `checkedOn`) and a notice that nothing was read by Ask Righto. Not found returns a search link for the provider, never a guess.

## Domestic courses

Stored: the CRICOS index only (existing `cricos-register` dataset and `cricos:refresh`). Rows are real CRICOS rows, so the 97 stand-ins and curated YAML go. Tools:

- `search_domestic_courses` (kept): filter the CRICOS index by name, provider, level, field, state or campus. Result per course: CRICOS code, provider, campuses, duration, and links.
- `get_domestic_course` (kept, simpler): one CRICOS row plus the provider's course page link (from the provider index entry), the Course Seeker and VTAC search links (link only, with the existing rule: never read VTAC pages for content beyond the link), and a **reading checklist**: entry figure with its kind and intake year, VCE prerequisites with study scores, other selection criteria, campus. The agent reads the university page and quotes with link and time.
- Removed: `compare_domestic_courses` (the agent compares what it read), `check_domestic_course_prerequisites`.

Limit to state plainly: CRICOS lists courses registered for international students, so a domestic-only course may be absent. Then the result gives the provider's course search link and says the index has no row. This is the cost of CRICOS-only (Iven, 27 Nov 2026).

Provider index: one entry per university (course search URL, admissions transparency page URL, domains), kept from the existing provider blocks. This is link data, not content.

## VCE planning

- Scaling: one source entry, the most recent VTAC ATAR scaling report (link; year updated each November/December when VTAC publishes), plus VCAA study score and scaling explainer. Tool `get_vce_admissions_sources` returns it with checklist ("scaled score for a study, the year of the report, whether a study is in the scaling table under its own or a grouped name"). No estimate tool.
- Aggregate: the skill explains in one paragraph how VTAC builds an aggregate (primary four studies, plus 10 percent of the fifth and sixth, with the English requirement), links to the VTAC page and tells the agent to read the current rule from it. If the rule text is not yet verified on a live page, the skill says only what the link says; task 3.4 verifies it. The agent calculates and labels the result "an aggregate, not an ATAR".
- Key dates, preference rules, early entry: link entries (VTAC key dates, VTAC preferences, each university's early offer page) with checklists. `get_vce_key_dates` and `list_early_entry_schemes` fold into the same sources tool unless Iven keeps the YAML.

## Home loans

Stored: nothing from the source. Kept: `src/homeloans/lenders.json` (brand, public base URI) as an index of endpoints; it is a pointer list, reviewed by pull request, and the guide links the CDR Register as the authority.

`get_cdr_banking_guide` (name in the pattern of `get_energy_guide`) returns, for a journey (`find`, `read_product`, `compare`), steps and structure facts in our words:

- Where: CDR Register, lender index, base URI + `/cds-au/v1/banking/products` (list) and `/products/{id}` (detail), version headers `x-v` (negotiate 5, then 4, then 3 for list; 7 for detail on the 12 tested lenders) and `x-min-v`.
- Objects: `BankingProductV6`, `BankingProductDetailV7`, lending rate (`rateType`, `rate` as a fraction, `comparisonRate`, `tiers`, `additionalInfo`), `fees`, `features`, `eligibility`, `constraints`, with pointers to dsb-schema-tools 1.35.0 (existing `docs/cdr-schemas.md`).
- Quirks from the 17 Nov run (kept in `docs/home-loan-data.md`, rewritten as an agent-facing note): fractions, tier bound types, DISCOUNT margins, 16-decimal strings, advertised min and max for one band, comparison rate below rate.
- Rules: general information, not advice; no ranking, "best" or "recommended"; ask for no personal data; quote each rate with the lender, the product link and the time fetched; a comparison rate is a marketing figure for a stated example loan.

`calculate_home_loan_repayments` stays only if Iven agrees: pure arithmetic on the user's inputs, no source data.

### Feasibility risk: the `x-v` header

CDR product endpoints require `x-v`. Hosts differ in whether their fetch tool can send headers. First task 1.1 tests Claude (web fetch and code execution), ChatGPT (browse and code interpreter) and Gemini, on three lenders. Outcomes and fallbacks:

1. Works in at least one host's sandbox: keep link-only, document which hosts, skill says so.
2. Works nowhere: options are (a) a header-adding pass-through URL on our server that fetches and returns the lender's JSON without storing it (more legal surface and load; must go through the same legal view as storage? likely lighter, but unconfirmed), (b) drop home loans from hosts that cannot. Decide with Iven then. Not built in this change.

## Rights register and docs

New basis `link_only` (status `cleared` once the link is checked). Rights entries `vic-courses`, `nsw-act-courses`, `qld-courses`, `vce-key-dates`, `vtac-preference-rules`, `vic-early-entry`, `vce-scaling`, `vce-study-groupings`, `vtac-coursesearch`, `uac-coursesearch`, `qtac-coursesearch`, `course-seeker`, `home-loans-cdr`, `rba-cash-rate` are removed or replaced by `link_only` entries (provider course pages, VTAC reports, CDR Register). `cricos-register` and `intl-courses` stay. Energy entries are untouched. `release-check.mjs` loses the home loans gate.

## Database

Migration 0011 drops the course, entry figure, prerequisite, VCE admissions, home loan and reference rate tables. It keeps `cricos_raw` and the CRICOS-backed course rows (renamed columns only if needed). Destructive but all rebuildable or retired; the real data lives only on Iven's WSL dev database, and each drop is listed in the task for review. Nothing is dropped from `askrighto` energy tables.

## Alternatives considered

- Keep the own-words store and ask permissions: rejected by Iven, too heavy.
- Server-side fetch on behalf of the user: it stores nothing but reads the source itself, which the terms of VTAC and others forbid. Not proposed.
- Health cover: separate decision (Open question 1).
