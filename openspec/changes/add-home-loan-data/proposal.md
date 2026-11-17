## Why

Home loan rates and fees are published by about a hundred lenders, each through its own Consumer Data Right (CDR) product endpoint. A comparison needs all of them joined, normalised and kept current, which is the same shape as energy plans and fits the case-selection test (complex, aggregated, large audience; ROADMAP row 3, score 14). The case is parked only on a regulatory question, so this change prepares the data layer and leaves the regulated part to later gates. Research and its unverified points: `docs/home-loans-research.md`.

## What Changes

- Add a client for the CDR banking Product Reference Data: Get Products (filtered to category `RESIDENTIAL_MORTGAGES`) and Get Product Detail, no authentication.
- Reuse the energy sync machinery instead of copying it: move the rate-limited, `Retry-After`-aware HTTP client, the per-brand limiter, the advisory lock and the report shape into a shared `src/cdr/` module that both energy and home loans use. Energy behaviour must not change.
- Add a brand list for lenders, seeded from the CDR Register's Data Holder Brands Summary API and checked in, with a check that reports brands that stop answering.
- Add a normalised home loan model: lender and brand, product name, purpose (owner-occupier or investor), repayment type, rate type (variable, fixed with term, introductory, discount, bundle), rate, comparison rate as published, LVR and balance tiers, fees by type, features (offset, redraw, extra repayments), constraints, eligibility, product links, `isTailored`, effective dates.
- Keep the source payload beside the normalised fields, flag shapes we do not understand rather than coerce them (as energy does), and never compute or repair a rate.
- Store in the shared PostgreSQL under the `askrighto` schema in new `home_loan_*` tables (migration `0005`), rebuildable from the API.
- Add the RBA cash rate target as a small reference table with source, date and RBA attribution; ingest nothing else from the RBA until its terms for those tables are read.
- Register datasets and rights entries, with status `cleared_pending_legal_view`: `home-loans-cdr` (basis `cdr_rule`) and `rba-cash-rate` (basis `open_licence`-style RBA terms, recorded as its own basis note).
- Record the field check against dsb-schema-tools 1.35.0 in `docs/cdr-schemas.md` and a new `docs/home-loan-data.md`.
- Schedule: daily list pass, detail only for changed products, rolling weekly re-check, the same overnight timer as energy (offset so the two syncs do not overlap).

Data sources and rights:

| Source | Licence or basis | Refresh |
| --- | --- | --- |
| CDR banking Product Reference Data, per lender | CDR Rules, product data disclosed without conditions on use (rule 1.4 outline verified; operative rule number unverified) | daily list, weekly full re-check |
| RBA cash rate target | RBA "Financial Data" terms: commercial use allowed, no implied endorsement, attribute "Source: Reserve Bank of Australia" | on RBA board decision dates, checked daily |

Hosts affected: none directly. No tool is added here; hosts see the data through `add-home-loan-tools` and `list_data_sources`.

Out of scope:

- Any tool, calculator or ranking (`add-home-loan-tools`).
- Consumer CDR data (a person's own loan), which needs accreditation.
- Personal loans, business loans, margin loans, credit cards, deposit and savings products (later banking changes).
- Scraping comparison sites or lender pages. Lender pages are links only.
- RBA indicator lending rate tables (F5, F6) until their third-party content terms are read.
- Borrowing capacity, eligibility decisions and any user data.

## Capabilities

### New Capabilities

- `home-loan-data`: the current set of published residential mortgage products, where they come from, how they are kept fresh and how each stays traceable to the lender's payload.

### Modified Capabilities

None. Energy's internals move to a shared CDR module with no change in behaviour; that is a requirement of `home-loan-data`, not a change to the `energy-plan-data` spec.

## Impact

- New `src/cdr/` (shared client, limiter, report), `src/homeloans/` (normalise, sync, store, cli, vertical), `src/homeloans/lenders.json`, migration `0005`, fixtures `test/fixtures/homeloans/`, docs.
- Energy files change only to import the shared client; its tests must pass unchanged.
- New outbound traffic to each lender's CDR host, roughly one list call per lender per day plus changed details (estimate **unverified**; measure in the first load).
- Depends on `add-mcp-server-core` and `add-energy-plan-data` (already built) and on `add-canary-release`.
