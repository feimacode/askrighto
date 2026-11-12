# Tasks

## 1. Confirm the API against real responses

- [ ] 1.1 Build the CDR client (list with paging, detail, version headers, timeout, backoff) and a `sync:energy --record` CLI mode; verify unit tests against a mock server cover paging through `links.next`, 429 with `Retry-After`, 5xx retry and a 404 plan
- [ ] 1.2 From a network that can reach the API (Iven's machine or a manually triggered GitHub Actions job), record list pages and at least 40 plan details across five or more retailers, both fuels, every plan type, a Victorian postcode and every `pricingModel` found; verify the fixtures are committed under `test/fixtures/energy/` with a README naming the capture date
- [ ] 1.3 Confirm the GST basis and units by checking three fixture plans against the retailers' published price sheets; verify the finding is written into `docs/energy-data.md` and `gstBasis` is set from it
- [ ] 1.4 Seed `retailers.json` from the AER base URI list and compare it once with the CDR Register's energy brands; verify a script reports any brand in one list and not the other

## 2. Normalised plan model

- [ ] 2.1 Define the zod schemas for list and detail payloads with passthrough, and the `EnergyPlan` types; verify every recorded fixture parses without error
- [ ] 2.2 Implement normalisation for supply charges, single-rate and block rates, time-of-use rates, controlled load, solar feed-in, discounts, fees, incentives, eligibility and terms, with integer money and the `understood` flag; verify golden-file tests for each `pricingModel` in the fixtures and a test that an unknown model is kept and flagged
- [ ] 2.3 Filter to current residential plans; verify a test drops a business-only fixture plan

## 3. Sync and store

- [ ] 3.1 Implement the per-retailer sync with change detection and removal of withdrawn plans; verify tests show no detail call for an unchanged plan, a refetch for a changed one, removal of a withdrawn one and retained data for a failing retailer
- [ ] 3.2 Implement the snapshot store with atomic write, gzip, load at start and postcode and id indexes; verify tests for included and excluded postcodes, a two-distributor postcode, an unknown postcode and an interrupted write leaving the old snapshot intact
- [ ] 3.3 Implement the background refresh timer and `ASKRIGHTO_DATA_DIR`; verify a test with a fake clock triggers a sync after 24 hours and that the server answers from the old snapshot while it runs
- [ ] 3.4 Produce a sync report (plans per retailer, per `pricingModel`, per `notUnderstood` reason, failures); verify the CLI prints it and a test checks its counts against fixtures

## 4. Registry and documentation

- [ ] 4.1 Register the dataset with publisher, reuse basis, URL, coverage, retailer and plan counts, failing retailers and `maxAgeHours`; verify `list_data_sources` returns it in a smoke test and that a stale snapshot triggers the warning
- [ ] 4.2 Write `docs/energy-data.md` covering source, reuse basis, what is and is not covered, refresh behaviour, settings and how to record fixtures; verify the documented CLI commands run as written

## 5. Licence and integration checks

- [ ] 5.1 Re-read CDR Rules rule 2.6 in the current compilation and the AER product data page, and confirm no terms restrict this use; record the date and links in `docs/energy-data.md`
- [ ] 5.2 Run one full sync from a network that can reach the API and attach the sync report to the pull request, including total time and request count
- [ ] 5.3 Build a seed snapshot from that sync for the image and verify the server starts and answers `list_data_sources` with no network

## Workflow follow-up

- Archive the change after review so `energy-plan-data` becomes a main spec.
