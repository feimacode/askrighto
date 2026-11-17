# Energy plan data

## Source and reuse basis

The only source is the AER's Consumer Data Right (CDR) energy product reference data API,
reached through `https://cdr.energymadeeasy.gov.au/{retailer}/cds-au/v1/energy/plans`
(list, `x-v: 1`; detail, `x-v: 3`). No authentication. Reuse basis: CDR Rules, rule 2.6
(product data may be used without restriction). **This has not been re-read in the current
compilation yet (task 6.1)**; the question goes into the planned legal view. We keep the copy
internal behind the tools and offer no bulk download. The sync never reads Energy Made Easy or
Victorian Energy Compare web pages.

## What is stored

Residential electricity, gas and dual fuel plans (standing, market, regulated) that are current
or start in the future, per retailer in `src/energy/retailers.json`.

**Retailer list.** The file holds 92 base URI path segments, seeded on 17 Nov 2026 from the AER
document *Consumer Data Right: Energy Retailer Base URIs and CDR Brands* (January 2026,
<https://www.aer.gov.au/system/files/2026-01/Consumer%20Data%20Right%20-%20Energy%20Retailer%20Base%20URIs%20and%20CDR%20Brands%20-%20January%202026.pdf>):
the 83 rows of its main table, which share 76 paths, plus 16 brands that only its change log
names (Simply Energy, Powerdirect, Circular Energy and others). Brands that share a path
(for example ARCLINE, Cooperative Power, RAA Energy, Indigo Power and Sonnen under
`/energy-locals/`) are one entry, and each plan keeps its own `brandName`. A path that is not
served answers 404 and is recorded in `retailers.last_error` without stopping the others, and
business-only retailers return no residential plans. Still to do (task 1.4): compare the list with
the CDR Register's energy brands, and re-read the AER document when it is next updated; the file
was transcribed through a text extraction of the PDF, so check the first sync report for 404s.

**To load them**, run on the VM (a full first load takes a while; retailers run 16 at a time,
each at 2 requests a second):

```
node dist/askrighto.js sync-energy
node dist/askrighto.js renormalise-energy   # only if plans loaded before the 16 Nov fixes remain
```

Tables (schema `askrighto`): `retailers`, `coverage_sets` (postcode lists stored once, GIN
indexed), `plans` (normalised `contract` plus the raw payload and its hash), `plan_changes`,
`sync_runs`. Money is stored as integer hundred-thousandths of a dollar. Postcode, fuel,
retailer, distributor and plan type filters are in `src/energy/store.ts`; future and expired
plans are hidden at read time.

## Refresh and verification

`npm run sync:energy` (or the server's daily timer, 02:30 Australia/Sydney, only after a first
load) does, per retailer:

1. List `CURRENT` and `FUTURE` plans. Fetch detail only for new plans or ones whose
   `lastUpdated` changed.
2. Re-fetch the longest-unverified unchanged plans (about a seventh of the total each day) and
   compare the content hash. A difference with an unchanged `lastUpdated` is a *silent change*:
   the row is replaced, a `plan_changes` row is written with `silent = true`, and the report
   counts it. If silent changes stay at zero for a month the re-check can be relaxed.
3. Apply all changes for the retailer in one transaction; plans no longer listed are removed.

A retailer that fails keeps its stored plans and is recorded in `retailers.last_error`; the others
carry on. One instance syncs at a time (`pg_try_advisory_lock`). The server never starts a first
load by itself: `/readyz` is 503 with `no_data_loaded` until `sync:energy` has run once.
`/healthz` never touches the database. If the database is unreachable, tools return
`data_unavailable` and do not answer from anywhere else.

## Rate limits

Each retailer is its own server with its own limits, and the AER host only routes requests.
The client sends at most `ASKRIGHTO_SYNC_PER_RETAILER_RPS` (default 2) requests a second and one
in flight to any retailer, and at most `ASKRIGHTO_SYNC_MAX_IN_FLIGHT` (default 8) overall. A 429
halves that retailer's rate and honours `Retry-After`; other retailers are unaffected. The sync
report lists requests and throttled responses per retailer. Observed limits belong here after the
first real load (task 6.3).

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | none | Without it the energy module is off |
| `DATABASE_SCHEMA` | `askrighto` | Must be `askrighto` or `askrighto_*` |
| `ASKRIGHTO_DB_POOL_MAX` | 5 | Pool size |
| `ASKRIGHTO_DB_SSL` | off | `true` to require TLS |
| `ASKRIGHTO_SYNC_PER_RETAILER_RPS` | 2 | Requests a second per retailer |
| `ASKRIGHTO_SYNC_MAX_IN_FLIGHT` | 8 | Overall requests in flight |
| `ASKRIGHTO_SYNC_SCHEDULE` | on | `off` disables the daily timer |
| `ASKRIGHTO_SYNC_AT` / `ASKRIGHTO_SYNC_TZ` | `02:30` / `Australia/Sydney` | When the timer fires |
| `ASKRIGHTO_CDR_BASE` | the AER host | Override for tests |

## First load

```sh
export DATABASE_URL=...   # see docs/local-database.md
npm run migrate
npm run sync:energy                  # prints the sync report; add -- --retailer agl to try one
npm run renormalise:energy -- --dry-run --show solarFeedIn   # re-run the normaliser on stored plans, no API calls
```

## Recording fixtures

```sh
npm run sync:energy -- --record test/fixtures/energy/recorded
```

saves every list page and plan detail under that folder. Record from a network that can reach the
host, check the files, and note the capture date in `test/fixtures/energy/README.md`. The
fixtures in the repository today are **synthetic**.

## GST basis: exclusive (confirmed 16 Nov 2026)

Rates and supply charges are published exclusive of GST, as the standards describe; a recorded
AGL plan matches its fact sheet once 10% is added. Fees are published including GST and feed-in
credits carry none, so both are used as published. Details and the worked example are in
[cdr-schemas.md](cdr-schemas.md#gst-what-the-standards-settle). The basis is stored with each
normalised contract, so after changing `src/energy/gst.ts` run `renormalise-energy`.

## Not done in this workspace

Tasks 1.2, 1.3, 1.4, 6.1, 6.2, 6.3 and 6.4 need the live API or the shared database; see
`openspec/changes/add-energy-plan-data/tasks.md`.
