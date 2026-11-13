# Design

## Context

Confirmed by Iven's proof of concept (`reference/cdr_energy.py`, run against the live API on 13 Nov 2026) and the AER fact sheet of February 2025:

- Base: `https://cdr.energymadeeasy.gov.au/{retailer}/cds-au/v1/energy/plans`, one path segment per retailer brand (for example `agl`).
- List: `GET …/plans` with header `x-v: 1`, parameters `type`, `fuelType`, `effective` (`CURRENT`, `FUTURE`, `ALL`), `updated-since`, `brand`, `page`, `page-size`; follows `links.next`; results ordered by `lastUpdated` descending. List items already carry `geography.includedPostcodes` and `geography.distributors`.
- Detail: `GET …/plans/{planId}` with `x-v: 3` (version 2 was retired in March 2025). Holds `electricityContract` and `gasContract` with `pricingModel`, `tariffPeriod[]` (`dailySupplyCharge`, `singleRate.rates[]`, `timeOfUseRates[]`), `solarFeedInTariff[]`, `discounts[]` and more. Prices are decimal strings.
- No authentication. The AER publishes a list of retailer base URIs (May 2024 document).
- The AER's host only routes requests to each retailer's own endpoint; the AER does not appear to apply rate limits itself (Iven's experience), and no limit or SLA is published. Each retailer may limit its own endpoint; one known retailer allows 10 requests a second. The CDR standards' traffic thresholds (for example 300 requests a second for all unauthenticated traffic) are guidance for data holders, not limits on callers.

Storage: the team runs a shared Azure PostgreSQL instance. `feimacode/feima-api` (Python, FastAPI) is the house reference for how a service uses it: `DATABASE_URL` plus a separate `DATABASE_SCHEMA` per application, a deliberately small connection pool (3 connections plus 2 overflow), `pool_pre_ping`, a 15 second connect timeout, versioned Alembic migrations that create the schema if absent, and `/health` separate from `/ready`. This design carries those conventions into TypeScript.

This cloud workspace cannot reach the CDR host (its network policy blocks it), so fixtures must be recorded from Iven's machine. Community research counted about 1,700 distinct plan shapes, so the normaliser must expect surprises. See proposal.md for motivation and the spec for requirements.

## Goals / Non-Goals

**Goals:**

- A full, current residential plan set that any server instance can query by postcode in milliseconds.
- A sync that is cheap for the source and writes only what changed.
- Nothing invented: unknown shapes are kept and flagged, never coerced.
- Several server instances sharing one copy of the data.

**Non-Goals:**

- Cost calculation (next change).
- User data of any kind in the database.
- Provisioning or administering the Azure instance.
- Real-time freshness. Plans change at most daily.

## Decisions

**1. Own copy in PostgreSQL, not live proxying.** The server keeps its own copy and tools never call the AER during a chat. A postcode comparison needs detail for every candidate plan across about a hundred retailers, which is far too slow and would load the source on every user question. Alternative considered: keep only the plan index and fetch prices on demand. Rejected: the first comparison for a postcode would need 100 to 300 calls, and an AER outage would break answers.

**2. External PostgreSQL, not a file or an embedded database.** Delta updates become row changes, plans stay out of server memory, and every instance reads the same data. Earlier drafts of this design used an in-memory snapshot file and then considered SQLite; both were set aside because the team already operates PostgreSQL and wants one database technology. Alternative: SQLite on a local volume. Rejected: each instance would hold and sync its own copy, and it adds a native dependency or experimental runtime module.

**3. Driver, migrations and layout.** `pg` (pure JavaScript, so the single-file bundle still works) with a small pool (default max 5, connect timeout 15 seconds, idle timeout 30 seconds, TLS as the Azure instance requires). Migrations are plain numbered SQL files in `migrations/`, applied by a small runner that creates the `askrighto` schema if absent and records versions in a table inside it, as feima-api's Alembic setup does; there is a command to apply them and the server refuses to start sync work if the schema version is behind. Queries are written as typed functions in `src/energy/store.ts`. Alternative: an ORM such as Drizzle or Prisma. Rejected for now: the data model is small and read-heavy, and fewer moving parts suits a single bundled file. Revisit if the schema grows.

**4. Schema `askrighto` in the shared database**, owned by a dedicated role with rights only on that schema. Settings: `DATABASE_URL`, `DATABASE_SCHEMA` (default `askrighto`), `ASKRIGHTO_DB_POOL_MAX`. Credentials come from the host's secret store and never enter the repository or the image.

**5. Tables.**

```
retailers      (slug pk, brand_name, active, last_sync_at, last_sync_ok, last_plan_count, last_error)
coverage_sets  (id pk, hash unique, included_postcodes int[], excluded_postcodes int[], distributors text[])
plans          (plan_id pk, retailer_slug fk, display_name, fuel_type, plan_type, customer_type,
                coverage_id fk, effective_from, effective_to, plan_url,
                source_last_updated, fetched_at, verified_at,
                understood bool, not_understood text[],
                contract jsonb,      -- normalised electricity / gas contract
                raw jsonb,           -- detail payload as received (TOAST-compressed)
                detail_hash text)
plan_changes   (id pk, plan_id, changed_at, source_last_updated, detail_hash, silent bool)
sync_runs      (id pk, started_at, finished_at, ok, report jsonb)
```

Indexes: GIN on `coverage_sets.included_postcodes`; `plans (coverage_id)`, `plans (retailer_slug)`, `plans (fuel_type, plan_type)`, `plans (verified_at)`. Many plans of a retailer share one postcode list, so postcode lists are stored once in `coverage_sets`, keyed by a hash of the sorted lists, which keeps the table small. A lookup is `coverage_sets.included_postcodes @> ARRAY[3000]` joined to `plans`, minus excluded postcodes and plans outside their effective dates. `plan_changes` keeps a small history (no raw payload) for "this plan changed" features later.

**6. Normalised model.** `contract` holds the shape below as JSON; money is stored as integer hundred-thousandths of a dollar to avoid floating-point drift, and the original decimal strings stay in `raw`.

```ts
type EnergyPlan = {
  planId: string; retailerSlug: string; brandName: string; displayName: string;
  fuelType: "ELECTRICITY" | "GAS" | "DUAL"; planType: "STANDING" | "MARKET" | "REGULATED";
  customerType: "RESIDENTIAL";
  geography: { includedPostcodes: string[]; excludedPostcodes: string[]; distributors: string[] };
  effectiveFrom?: string; effectiveTo?: string;
  electricity?: Contract; gas?: Contract;
  planUrl?: string;
  sourceLastUpdated: string; fetchedAt: string; verifiedAt: string;
  understood: boolean; notUnderstood: string[];   // e.g. ["pricingModel:QUOTA"]
};
type Contract = {
  pricingModel: string; gstBasis: "EXCLUSIVE" | "INCLUSIVE" | "UNKNOWN";
  tariffPeriods: TariffPeriod[];                  // seasonal date ranges, supply charge, rates
  controlledLoads: ControlledLoad[]; solarFeedIn: FeedIn[];
  discounts: Discount[]; fees: Fee[]; incentives: Incentive[]; eligibility: Eligibility[];
  terms: { contractLength?: string; billFrequency?: string[]; paymentOptions?: string[] };
};
```

Rates keep `unitPrice`, `measureUnit`, `volume` and the block period. Time-of-use rates keep `type` (peak, shoulder, off-peak), days and time windows.

**7. Change detection, in three levels.**
1. Each sync lists every retailer twice, once with `effective=CURRENT` and once with `effective=FUTURE`, at the largest page size the API accepts. That gives the set of plan ids offered, the `lastUpdated` of each, and their postcodes and distributors.
2. A plan is fetched in detail if its id is new or its `lastUpdated` differs from the stored value. Plans in the database but missing from both lists are deleted.
3. Rolling re-check: each day the sync also fetches detail for the plans with the oldest `verified_at`, about one seventh of the total, and compares `detail_hash`. A differing hash with an unchanged `lastUpdated` is a silent change: the row is replaced, a `plan_changes` row is written with `silent = true`, and the report counts it.

`updated-since` is not used alone because it cannot show withdrawn plans. If list passes prove slow it can become a shortcut with a full pass each week. The silent-change count tells us whether `lastUpdated` can be trusted; if it stays at zero for a month, the re-check can be relaxed.

**8. One transaction per retailer.** The sync fetches everything for a retailer first, then applies inserts, updates and deletes in a single transaction. Readers see the old or the new set for that retailer, never a mix. A failed retailer is left untouched and recorded in `retailers.last_error`. Cross-retailer atomicity is not needed.

**9. One sync at a time, in the server or from the command line.** The server runs a daily timer, defaulting to 02:30 Australia/Sydney, and tries `pg_try_advisory_lock(<fixed key>)`; an instance that does not get the lock skips the run. `npm run sync:energy` takes the same lock and runs the same code from a shell, for the first load, for recovery and for recording fixtures. The first load is not started by the server automatically: `/readyz` stays 503 with `no_data_loaded` until someone runs it, so a half-empty database never serves answers. Alternative: a separate scheduled job outside the server. Deferred: the in-process timer needs no new infrastructure on the shared VM, and the lock makes it safe.

**10. Polite client, with limits per retailer.** Because each retailer is its own server with its own limits, the limiter works per retailer: at most 2 requests a second and 1 in flight to any one retailer (a fifth of the lowest limit we know of), plus an overall ceiling of 8 requests in flight so the routing host is not flooded. A 429 or 503 from a retailer slows only that retailer: it halves that retailer's rate, waits for `Retry-After`, retries up to three times with jitter, and then marks the retailer failed for the day without affecting the others. 30 second timeout. Headers: `x-v`, `x-min-v`, `User-Agent: AskRighto/<version>`. No personal details in any request. Settings: `ASKRIGHTO_SYNC_PER_RETAILER_RPS` (default 2), `ASKRIGHTO_SYNC_MAX_IN_FLIGHT` (default 8). Retailers run in parallel, so a first load takes about as long as the biggest retailer: at 2 requests a second, 1,000 plans is about 8 minutes, and the whole load is likely under 20 minutes. The report breaks calls and throttled responses down per retailer, so the first run also discovers each retailer's real limit. Whether to write to the AER is optional now that the host only routes.

**11. Reading, caching and outages.** Tools read through `store.ts`. A small in-process cache holds postcode lookups for a few minutes, since plans change at most daily. If the database cannot be reached, tools return `found: false` with reason `data_unavailable`; they never answer from memory or another source. If the AER is down but the database is up, tools keep answering from stored data, with the staleness warning once the newest successful sync is older than 48 hours. `/healthz` (liveness) does not touch the database; `/readyz` checks the connection and that plans exist.

**12. Retailer list is a checked-in JSON file** seeded from the AER's published base URI list: `{ slug, brandName, active }`, loaded into `retailers` by the sync. The sync logs retailers that return 404 or no plans for seven days. A task compares the list once with the CDR Register's energy brands.

**13. GST basis is recorded per contract, not assumed.** The standards describe plan amounts as exclusive of GST, but this is confirmed against recorded fixtures and a known retailer price sheet in task 1.3 before any tool shows a dollar figure. Until then the field reads `UNKNOWN` and the tools change must not ship.

**14. Tolerant parsing with zod `passthrough` and a `notUnderstood` list.** Unknown enum values and missing optional blocks never throw; they set `understood: false`. The sync report counts plans by `pricingModel` and by reason, so gaps are visible.

**15. Source and as-of for tools.** The registry entry is `{ name: "Australian Energy Regulator, energy product reference data (Consumer Data Right)", url: "https://www.aer.gov.au/energy-product-reference-data", licence: "Consumer Data Right Rules, rule 2.6 (no restriction on use of product data)" }`. Each plan's `asOf` is `source_last_updated`, and its URL is `plan_url` when present. The dataset `asOf` is the last successful sync time, and `maxAgeHours` is 48.

**16. Testing.** Unit tests run against recorded fixtures with the CDR client mocked. Store and sync tests run against a real PostgreSQL: a service container in CI, and a local database (for example on Iven's home PC) in development, with a throwaway schema created per test run.

## Risks / Trade-offs

- [The shared database becomes a dependency of every energy answer] → Small pool, 15 second connect timeout, a clear `data_unavailable` result, a separate readiness check, and a short in-process cache.
- [Sharing an instance with other services] → Own schema and role, small pool, and one tiny set of tables; load is a few queries a second at most.
- [The API cannot be reached from this workspace] → Record fixtures with the CLI from Iven's machine; all other work runs against fixtures and a local PostgreSQL.
- [A retailer may throttle or block us, and limits are unpublished and differ by retailer] → Per-retailer rate (2 a second) and one request in flight each, adaptive slow-down on 429, an overnight run, per-retailer measurement in the sync report, and one retailer's failure never stops the others.
- [`lastUpdated` may not change when prices do] → Rolling weekly re-check by content hash, with silent changes counted.
- [Plan shapes the normaliser misreads would produce wrong prices later] → Golden-file tests on real fixtures across every `pricingModel` seen; the `understood` flag excludes doubtful plans from cost estimates.
- [Retailer slugs change or new retailers appear] → The seven-day failure report, plus a quarterly task to re-read the AER list.
- [Rule 2.6 was read in the February 2020 Rules, and the Energy Made Easy FAQ says the AER is "prevented by law and regulations from releasing or broadly sharing" its plan data and offers no file downloads] → Task 5.1 re-checks the current compilation; we keep the copy internal behind the tools and offer no bulk download; the question goes into the planned legal view.
- [Migrations run against a database other services share] → The runner only touches the `askrighto` schema and refuses to run elsewhere.

## Migration Plan

1. The database administrator creates the `askrighto` schema and role on the shared instance (no tables).
2. Apply migrations from the command line.
3. Run the first sync from the command line and check the report.
4. Start the server; `/readyz` turns 200.
5. Rollback: stop the server and drop the `askrighto` schema; nothing outside it is affected.

## Open Questions

- The largest `page-size` the API accepts (the proof of concept used 100). It only affects the number of list calls.
- Whether Victorian plans appear under the same retailer paths or need extra brands. Task 1.2 answers it from fixtures; it changes only the retailer list.
- Which role the Azure instance should give the server: one role that can migrate and write, or a read-only role for tools plus a writer for the sync. This depends on how the shared instance is administered; the code works with either.
