# Tasks

## 1. Confirm the API against real responses

- [ ] 1.1 Build the CDR client (list with paging for `CURRENT` and `FUTURE`, detail, version headers, timeout, global rate cap, concurrency limit, `Retry-After` backoff) and a `sync:energy --record` CLI mode; verify unit tests against a mock server cover paging through `links.next`, 429 with `Retry-After`, 5xx retry, a 404 plan, and that no second ever exceeds the configured request cap
- [ ] 1.2 From a network that can reach the API (Iven's machine or a manually triggered GitHub Actions job), record list pages and at least 40 plan details across five or more retailers, both fuels, every plan type, a Victorian postcode, a future-dated plan and every `pricingModel` found; verify the fixtures are committed under `test/fixtures/energy/` with a README naming the capture date
- [ ] 1.3 Confirm the GST basis and units by checking three fixture plans against the retailers' published price sheets; verify the finding is written into `docs/energy-data.md` and `gstBasis` is set from it
- [ ] 1.4 Seed `retailers.json` from the AER base URI list and compare it once with the CDR Register's energy brands; verify a script reports any brand in one list and not the other

## 2. Normalised plan model

- [ ] 2.1 Define the zod schemas for list and detail payloads with passthrough, and the `EnergyPlan` types; verify every recorded fixture parses without error
- [ ] 2.2 Implement normalisation for supply charges, single-rate and block rates, time-of-use rates, controlled load, solar feed-in, discounts, fees, incentives, eligibility and terms, with integer money and the `understood` flag; verify golden-file tests for each `pricingModel` in the fixtures and a test that an unknown model is kept and flagged
- [ ] 2.3 Filter to residential plans and compute a stable hash of each detail payload; verify a test drops a business-only fixture plan and that the hash ignores field order

## 3. Database

- [ ] 3.1 Add the `pg` pool (max 5, 15 second connect timeout, TLS option), the settings `DATABASE_URL`, `DATABASE_SCHEMA` and `ASKRIGHTO_DB_POOL_MAX`, and the migration runner that creates the schema and records versions; verify tests against a real PostgreSQL apply the migrations twice with no error and refuse to run against another schema
- [ ] 3.2 Write migration `0001` with the tables, constraints and indexes in the design (including the GIN index on postcodes); verify a test inspects the catalog for each table and index, and that `EXPLAIN` of the postcode lookup uses the GIN index on a loaded fixture set
- [ ] 3.3 Add the PostgreSQL service container to CI and a `docs/local-database.md` for a local database (create database, role and schema); verify CI runs the database tests green and the documented local commands work on a developer machine

## 4. Sync and store

- [ ] 4.1 Implement the per-retailer sync: both list passes, new and changed detection, deletion of withdrawn plans, coverage-set deduplication and a single transaction per retailer; verify tests show no detail call for an unchanged plan, a refetch for a changed one, removal of a withdrawn one, retained data for a failing retailer, and no half-written retailer after an injected failure
- [ ] 4.2 Implement the rolling re-check by `verified_at`, silent-change detection and `plan_changes` rows; verify a test with a fake clock shows every plan verified within seven daily runs and a silent change counted
- [ ] 4.3 Implement the advisory lock, the daily timer (default 02:30 Australia/Sydney) and the `sync:energy` command; verify a test with two concurrent runners shows one syncs and the other skips without error
- [ ] 4.4 Implement the store reads: plans by postcode with fuel, retailer, distributor and plan type filters, excluded postcodes, effective-date filtering, plan by id, and the short in-process cache; verify tests for a two-distributor postcode, an unknown postcode, a future-dated plan hidden until its date, an expired plan hidden, and cache expiry
- [ ] 4.5 Produce the sync report (requests, throttled and failed requests, elapsed time, added, changed, silent and removed plans, plans per retailer and per `pricingModel`, not-understood reasons, table sizes) and store it in `sync_runs`; verify the CLI prints it and a test checks its counts against fixtures

## 5. Serving, registry and documentation

- [ ] 5.1 Return `found: false` with reason `data_unavailable` when the database cannot be reached, and add `/readyz` (200 only with data, 503 with reason otherwise) while `/healthz` stays database-free; verify tests stop the database mid-test and check the tool result, `/readyz` and `/healthz`
- [ ] 5.2 Register the dataset with publisher, reuse basis, URL, coverage, retailer and plan counts, failing retailers and `maxAgeHours`; verify `list_data_sources` returns it in a smoke test and that stale data triggers the warning
- [ ] 5.3 Write `docs/energy-data.md` covering source, reuse basis, coverage, refresh and verification behaviour, settings, the rate cap, how to run the first load and how to record fixtures; verify the documented commands run as written

## 6. Licence, load and integration checks

- [ ] 6.1 Re-read CDR Rules rule 2.6 in the current compilation, the AER product data page and the Energy Made Easy data access FAQ, and confirm no terms restrict this use or an internal copy; record the date and links in `docs/energy-data.md`
- [ ] 6.2 Run one full first load against the real API from a network that can reach it and attach the sync report to the pull request, including total time, request count, throttled responses, plan counts and database size; verify the numbers are compared with the estimates in the design and any large difference is written up
- [ ] 6.3 Draft the email to the AER's CDR support address describing the load (first load, then about 1,500 to 2,500 calls a day overnight) and asking for any limits in writing; verify Iven has reviewed it (nothing is sent by Claude)
- [ ] 6.4 Confirm with whoever administers the shared Azure PostgreSQL instance that the `askrighto` schema and role exist and which role model applies; verify the server starts against it and `/readyz` returns 200 after the first load

## Workflow follow-up

- Archive the change after review so `energy-plan-data` becomes a main spec.
