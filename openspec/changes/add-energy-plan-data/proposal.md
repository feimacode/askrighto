# Proposal

## Why

Comparing energy plans for a postcode means looking across every retailer at once, but the Consumer Data Right energy API is split per retailer and returns one plan's prices per call. Answering from the live API inside a chat turn would take hundreds of calls. Ask Righto needs its own current copy of the published plans, refreshed on a schedule, that tools can query in milliseconds and that still points back to the source for every plan.

The copy lives in the shared Azure PostgreSQL instance the team already runs, not in a file. A database lets a daily sync change only the rows that changed, keeps plans out of server memory, and lets any number of server instances answer from the same data.

## What Changes

- Add a client for the AER's CDR energy product reference data API: Get Generic Plans (version 1) and Get Generic Plan Detail (version 3), no authentication.
- Add a checked-in list of retailer brands with their API base paths, and a check that reports retailers that stop answering.
- Add a sync that walks every retailer, lists current and future-dated plans, fetches detail only for new or changed plans, re-verifies a rolling share of unchanged plans each day, and removes plans that are no longer offered.
- Add a normalised plan model for residential electricity and gas plans: retailer, plan type, postcodes and distributors, supply charges, usage rates (single rate, block, time of use), controlled load, solar feed-in, discounts, fees, incentives, eligibility, contract terms, and the plan's own link.
- Keep the source's own detail payload beside the normalised fields, so nothing is reworded or lost.
- Store everything in PostgreSQL under its own schema (`askrighto`) in the shared database, with versioned SQL migrations, a small connection pool and a postcode index.
- Make the sync gentle on the source: a global request-rate cap, low concurrency, `Retry-After` handling, an overnight schedule, and a report of calls, throttled responses and elapsed time.
- Let one instance sync at a time using a database lock, so several server instances can run safely.
- Add a readiness endpoint that reports whether the database is reachable and holds energy data.
- Register the dataset in the data source registry with publisher, reuse basis, coverage and last refresh time.
- Add a command-line sync for local use, for the first load and for recording test fixtures.

Data source: Australian Energy Regulator energy product reference data, which also carries Victorian plans from the Victorian Department of Energy, Environment and Climate Action. Reuse basis: Consumer Data Right Rules, rule 2.6, under which a data holder must not restrict use of disclosed product data. Refresh cadence: a daily list pass over every retailer, with detail fetched only for changed plans and a rolling weekly re-check of all others.

Hosts affected: none directly. This change adds no tool; Claude, ChatGPT and Gemini see the data through `add-energy-plan-tools` and through a new entry in `list_data_sources`.

Out of scope:

- Any lookup or comparison tool, and any cost estimate (see `add-energy-plan-tools`).
- Business plans. They are skipped in the first release.
- Scraping energymadeeasy.gov.au or compare.energy.vic.gov.au. Only the API is used.
- Consumer-specific CDR data (a person's own usage or account), which needs accreditation.
- Reference prices (Default Market Offer, Victorian Default Offer) and usage benchmarks, which are separate sources.
- Western Australia and the Northern Territory, which the API does not cover.
- Any user data in the database. It holds public plan data only and can be rebuilt from the API.
- Provisioning the Azure database or its network access. The team already runs it; this change only asks for a schema and a role.

## Capabilities

### New Capabilities

- `energy-plan-data`: the current set of published residential energy plans: where it comes from, how it is kept fresh and stored, what each plan record holds and how it stays traceable to the source.

### Modified Capabilities

None.

## Impact

- New code: `src/energy/cdr-client.ts`, `src/energy/retailers.json`, `src/energy/sync.ts`, `src/energy/normalise.ts`, `src/energy/store.ts`, `src/db/` (pool, migration runner), `migrations/`, `scripts/sync-energy.ts`, fixtures under `test/fixtures/energy/`.
- Depends on `add-mcp-server-core` for the source registry and staleness warning.
- New dependencies: `pg` (the Node PostgreSQL driver, pure JavaScript) and a SQL migration runner; dev: a PostgreSQL service in CI.
- New settings: `DATABASE_URL`, `DATABASE_SCHEMA`, pool size, sync rate and schedule. The database credentials are secrets and never enter the repository or the image.
- New outbound traffic from the server to `cdr.energymadeeasy.gov.au`, about 1,500 to 2,500 calls a day after the first load.
- A role with rights on the `askrighto` schema only, created by whoever administers the shared Azure instance.
- `reference/cdr_energy.py` in this change folder is Iven's working Python proof of concept, kept as a reference for the API shape. `feimacode/feima-api` is the reference for database conventions (async pool, per-app schema, Alembic-style versioned migrations, `DATABASE_URL`).
