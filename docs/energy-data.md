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
or start in the future, per retailer in `src/energy/retailers.json`. **That list currently holds
only AGL, Origin and EnergyAustralia**, the brands seen in the proof of concept; seeding the
full list from the AER base URI document and comparing it with the CDR Register (task 1.4)
needs network access this workspace lacks.

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
```

## Recording fixtures

```sh
npm run sync:energy -- --record test/fixtures/energy/recorded
```

saves every list page and plan detail under that folder. Record from a network that can reach the
host, check the files, and note the capture date in `test/fixtures/energy/README.md`. The
fixtures in the repository today are **synthetic**.

## GST basis: not yet confirmed

The standards describe plan amounts as exclusive of GST, but `gstBasis` is `UNKNOWN`
(`src/energy/gst.ts`) until three recorded plans are checked against the retailers' published
price sheets (task 1.3). Tools must not show dollar figures while it is `UNKNOWN`.

## Not done in this workspace

Tasks 1.2, 1.3, 1.4, 6.1, 6.2, 6.3 and 6.4 need the live API or the shared database; see
`openspec/changes/add-energy-plan-data/tasks.md`.
