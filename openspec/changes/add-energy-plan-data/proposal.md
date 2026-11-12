# Proposal

## Why

Comparing energy plans for a postcode means looking across every retailer at once, but the Consumer Data Right energy API is split per retailer and returns one plan's prices per call. Answering from the live API inside a chat turn would take hundreds of calls. Ask Righto needs its own current copy of the published plans, refreshed on a schedule, that tools can query in milliseconds and that still points back to the source for every plan.

## What Changes

- Add a client for the AER's CDR energy product reference data API: Get Generic Plans (version 1) and Get Generic Plan Detail (version 3), no authentication.
- Add a checked-in list of retailer brands with their API base paths, and a check that reports retailers that stop answering.
- Add a sync that walks every retailer, lists current plans, fetches detail only for new or changed plans, and drops plans that are no longer current.
- Add a normalised plan model for residential electricity and gas plans: retailer, plan type, postcodes and distributors, supply charges, usage rates (single rate, block, time of use), controlled load, solar feed-in, discounts, fees, incentives, eligibility, contract terms, and the plan's own link.
- Keep the source's own field values alongside the normalised ones, so nothing is reworded or lost.
- Store the result as a snapshot the server loads at start and refreshes daily in the background.
- Register the dataset in the data source registry with publisher, reuse basis, coverage and last refresh time.
- Add a command-line sync for local use and for recording test fixtures.

Data source: Australian Energy Regulator energy product reference data, which also carries Victorian plans from the Victorian Department of Energy, Environment and Climate Action. Reuse basis: Consumer Data Right Rules, rule 2.6, under which a data holder must not restrict use of disclosed product data. Refresh cadence: daily full list pass with detail fetched only for changed plans.

Hosts affected: none directly. This change adds no tool; Claude, ChatGPT and Gemini see the data through `add-energy-plan-tools` and through a new entry in `list_data_sources`.

Out of scope:

- Any lookup or comparison tool, and any cost estimate (see `add-energy-plan-tools`).
- Business plans. They are skipped in the first release.
- Scraping energymadeeasy.gov.au or compare.energy.vic.gov.au. Only the API is used.
- Consumer-specific CDR data (a person's own usage or account), which needs accreditation.
- Reference prices (Default Market Offer, Victorian Default Offer) and usage benchmarks, which are separate sources.
- Western Australia and the Northern Territory, which the API does not cover.

## Capabilities

### New Capabilities

- `energy-plan-data`: the current set of published residential energy plans: where it comes from, how it is kept fresh, what each plan record holds and how it stays traceable to the source.

### Modified Capabilities

None.

## Impact

- New code: `src/energy/cdr-client.ts`, `src/energy/retailers.json`, `src/energy/sync.ts`, `src/energy/normalise.ts`, `src/energy/store.ts`, `scripts/sync-energy.ts`, fixtures under `test/fixtures/energy/`.
- Depends on `add-mcp-server-core` for the source registry and staleness warning.
- New outbound traffic from the server to `cdr.energymadeeasy.gov.au`, about one full pass a day.
- New setting for the snapshot directory, which needs a writable volume in deployment.
- `reference/cdr_energy.py` in this change folder is Iven's working Python proof of concept, kept as a reference for the API shape.
