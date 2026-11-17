## 1. Confirm against real responses (needs a machine that can reach the lenders)

- [ ] 1.1 Call the Register's Data Holder Brands Summary API; record the URL, version header and fields in `docs/home-loan-data.md`; verify the file lists at least the four major banks and states which brands publish product data
- [ ] 1.2 Record Get Products (list) and Get Product Detail for at least 15 lenders, including the four majors, a mutual or credit union, a non-bank lender if listed, a fixed rate, an investor loan, an offset product, an `isTailored` product and one with LVR tiers; commit under `test/fixtures/homeloans/` with a README naming the capture date; verify each fixture parses
- [ ] 1.3 Check what the data actually holds and write it down in `docs/home-loan-data.md`: headline vs discounted rates, how fixed terms are written, whether `comparisonRate` is filled and on what basis, fee completeness, share of tailored and expired products, mixed categories; verify each point cites at least one fixture
- [ ] 1.4 Read the operative CDR Rules sections on product data requests and write the rule number and wording into `docs/data-rights.md` (replacing the rule 1.4 outline reference); verify the date read is recorded

## 2. Shared CDR core

- [x] 2.1 Extract the HTTP client, limiter, lock helper and report types to `src/cdr/`; verify the existing energy tests pass unchanged and `src/energy/` re-exports the same names *(Note: HTTP core and limiter moved to `src/cdr/`; the sync loop is still a separate copy in `src/homeloans/sync.ts`)*
- [x] 2.2 Add per-host base URI support (energy uses one host; banking uses one per lender); verify a test with two mock hosts shows independent rate limits

## 3. Lender list

- [ ] 3.1 Write `scripts/seed-lenders.ts` and check in `src/homeloans/lenders.json`; verify every entry has a base URI and the script prints brands present in the Register but missing from the file
- [ ] 3.2 Implement `check:lenders` (Register vs file vs live response); verify a test with a mock Register reports an added, a removed and an unresponsive brand

## 4. Normalised model and database

- [x] 4.1 Add migration `0006` with the tables in design.md and indexes on `(lender_slug)`, `(understood)` and `((detail->>'purposes'))` as needed; verify a catalog test and that migrations apply twice with no error *(Note: indexes are on `verified_at` and `understood`; no `detail` expression index)*
- [x] 4.2 Implement normalisation for rates, tiers, fees, features, constraints, eligibility and links, with the `understood` flag; verify golden tests per rate type and a test that an unknown type, unknown tier unit and unreadable fixed term are kept and flagged, and that no rate is ever altered or computed *(Note: tested on synthetic fixtures only)*
- [ ] 4.3 Pin the percent convention (`RateString`) with a test using a recorded rate and the lender's own product page figure; verify the test names the lender and capture date

## 5. Sync

- [x] 5.1 Implement the per-lender sync (list, changed detection, detail fetch, withdrawn removal, one transaction per lender, failure keeps old data); verify tests for each branch including no detail call for an unchanged product and no half-written lender after an injected failure *(Note: tested against a mock lender server, not live lenders)*
- [x] 5.2 Implement the rolling re-check, silent-change detection, advisory lock, daily timer (03:30 Australia/Sydney) and `sync:homeloans` CLI with the report; verify a fake-clock test shows every product verified within seven runs and two concurrent runners do not both sync
- [x] 5.3 Implement store reads: products by filters, product by `(lender, id)`, count of `understood: false` products; verify tests for a withdrawn product, an expired product and a lender that failed its last sync (old `verified_at` kept)

## 6. RBA cash rate

- [ ] 6.1 Find a stable source for the cash rate target and record the page, format and terms in `docs/home-loan-data.md`; verify the RBA copyright wording read on 17 Nov 2026 is still current
- [x] 6.2 Implement the cash rate job and `reference_rates` reads; verify the stored row carries date, value, source URL and the attribution text *(Note: the cash rate is entered by hand with its RBA link via `homeloans:cash-rate`; no automated fetch)*

## 7. Registry, rights and docs

- [x] 7.1 Register `home-loans-cdr` and `rba-cash-rate` datasets with publisher, source URL, coverage (lenders, products, failing lenders), `maxAgeHours` 48; verify `list_data_sources` lists them only on a route that serves the `home-loans` vertical
- [x] 7.2 Add both entries to `docs/data-rights.md` and `src/core/rights.json` as `cleared_pending_legal_view` with evidence from the research doc; verify the consistency test passes and `npm run release:check` lists them as blocking public release
- [x] 7.3 Write `docs/home-loan-data.md` (source, reuse basis, coverage, refresh, settings, first load, fixtures) and extend `docs/cdr-schemas.md` with the banking field check; verify commands in the document run as written
- [ ] 7.4 Add a task-level check that the data licence and the RBA terms are still current before shipping (read both pages again and record the date)

## 8. First load

- [ ] 8.1 Run one full load against the live lenders; attach the report (requests, throttled, failed, time, products per lender, `understood` rate, database size) to the pull request; verify any retailer that throttles has a recorded per-lender rate
