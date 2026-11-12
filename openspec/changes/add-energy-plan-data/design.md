# Design

## Context

Confirmed by Iven's proof of concept (`reference/cdr_energy.py`, run against the live API on 13 Nov 2026) and the AER fact sheet of February 2025:

- Base: `https://cdr.energymadeeasy.gov.au/{retailer}/cds-au/v1/energy/plans`, one path segment per retailer brand (for example `agl`).
- List: `GET …/plans` with header `x-v: 1`, parameters `type`, `fuelType`, `effective`, `updated-since`, `brand`, `page`, `page-size`; follows `links.next`; results ordered by `lastUpdated` descending. List items already carry `geography.includedPostcodes` and `geography.distributors`.
- Detail: `GET …/plans/{planId}` with `x-v: 3` (version 2 was retired in March 2025). Holds `electricityContract` and `gasContract` with `pricingModel`, `tariffPeriod[]` (`dailySupplyCharge`, `singleRate.rates[]`, `timeOfUseRates[]`), `solarFeedInTariff[]`, `discounts[]` and more. Prices are decimal strings.
- No authentication. The AER publishes a list of retailer base URIs (May 2024 document).

This cloud workspace cannot reach the API (its network policy blocks the host), so fixtures must be recorded from Iven's machine or from GitHub Actions. Community research counted about 1,700 distinct plan shapes, so the normaliser must expect surprises. See proposal.md for motivation and specs for requirements.

## Goals / Non-Goals

**Goals:**

- A full, current residential plan set in memory, queryable by postcode in milliseconds.
- A sync that is cheap for the source: one list pass per retailer per day, detail only on change.
- Nothing invented: unknown shapes are kept and flagged, never coerced.

**Non-Goals:**

- Cost calculation (next change).
- A database server. The data is read-only reference data, as in the previous pilot.
- Real-time freshness. Plans change at most daily.

## Decisions

**1. Snapshot, not live proxy.** The server keeps its own copy and tools never call the AER during a chat. Alternative: call the API per request. Rejected: a postcode comparison needs detail for every candidate plan across about a hundred retailers, which is far too slow and would load the source on every user question.

**2. Sync runs inside the server process on a timer, and the same code runs as a CLI.** On start the server loads the snapshot from `ASKRIGHTO_DATA_DIR`; if it is older than 24 hours it syncs in the background, then every 24 hours. `npm run sync:energy` runs the same sync from a shell. The Docker image ships a seed snapshot so a fresh container can answer at once. Alternative: a nightly GitHub Actions job that bakes data into a new image. Rejected for now: it ties data freshness to redeploys on infrastructure not yet read (`feima-infra`). It remains a fallback if the VM cannot reach the API. With several instances each syncs on its own, which the pilot's single instance does not need to solve.

**3. In-memory store loaded from a gzipped JSON snapshot.** Indexes: postcode to plan ids, plan id to record. Written to a temporary file and renamed, so readers never see a partial snapshot. Alternative: SQLite. Rejected: it adds a native dependency to a server that otherwise bundles to one file, and the residential set (several thousand plans) fits in memory comfortably. Revisit if memory passes about 300 MB.

**4. Two-level change detection.** Each sync does a full list pass per retailer with `effective=CURRENT` and the largest page size the API accepts. That gives the current id set (for deletions) and each plan's `lastUpdated` (for changes). Detail is fetched only where `lastUpdated` differs from the stored value. `updated-since` is not used alone because it cannot reveal withdrawn plans.

**5. Retailer list is a checked-in JSON file** seeded from the AER's published base URI list: `{ slug, brandName, active }`. The sync logs retailers that return 404 or no plans for seven days. Alternative: discover brands from the CDR Register at run time. Deferred: it is a second moving part, and the AER list is the documented source. A task compares the two once.

**6. Normalised model keeps the source beside it.**

```ts
type EnergyPlan = {
  planId: string; retailerSlug: string; brandName: string; displayName: string;
  fuelType: "ELECTRICITY" | "GAS" | "DUAL"; planType: "STANDING" | "MARKET" | "REGULATED";
  customerType: "RESIDENTIAL";
  geography: { includedPostcodes: string[]; excludedPostcodes: string[]; distributors: string[] };
  electricity?: Contract; gas?: Contract;
  planUrl?: string;
  sourceLastUpdated: string; fetchedAt: string;
  understood: boolean; notUnderstood: string[];   // e.g. ["pricingModel:QUOTA"]
  raw: unknown;                                   // detail payload as received
};
type Contract = {
  pricingModel: string; gstBasis: "EXCLUSIVE" | "INCLUSIVE" | "UNKNOWN";
  tariffPeriods: TariffPeriod[];                  // seasonal date ranges, supply charge, rates
  controlledLoads: ControlledLoad[]; solarFeedIn: FeedIn[];
  discounts: Discount[]; fees: Fee[]; incentives: Incentive[]; eligibility: Eligibility[];
  terms: { contractLength?: string; billFrequency?: string[]; paymentOptions?: string[] };
};
```

Money is parsed from the source's decimal strings into integer hundred-thousandths of a dollar to avoid floating-point drift; the original string stays in `raw`. Rates keep `unitPrice`, `measureUnit`, `volume` and the block period. Time-of-use rates keep `type` (peak, shoulder, off-peak), days and time windows.

**7. GST basis is recorded per contract, not assumed.** The standards describe plan amounts as exclusive of GST, but this is to be confirmed against recorded fixtures and a known retailer price sheet in task 1.3 before any tool shows a dollar figure. Until confirmed the field reads `UNKNOWN` and the tools change must not ship.

**8. Tolerant parsing with zod `passthrough` and a `notUnderstood` list.** Unknown enum values and missing optional blocks never throw; they set `understood: false`. A sync report counts plans by `pricingModel` and by `notUnderstood` reason, so the gaps are visible.

**9. Client behaviour.** Concurrency 4 across retailers, one request at a time per retailer, 30 second timeout, retries with exponential backoff on 429 and 5xx (honouring `Retry-After`), `x-v` and `x-min-v` headers, `User-Agent: AskRighto/<version>`. No personal details in any request.

**10. Source and as-of for tools.** The registry entry is `{ name: "Australian Energy Regulator, energy product reference data (Consumer Data Right)", url: "https://www.aer.gov.au/energy-product-reference-data", licence: "Consumer Data Right Rules, rule 2.6 (no restriction on use of product data)" }`. Each plan's own `asOf` is `sourceLastUpdated`, and its URL is `planUrl` when present. The dataset `asOf` is the last successful sync time, and `maxAgeHours` is 48.

## Risks / Trade-offs

- [The API cannot be reached from this workspace] → Record fixtures with the CLI from Iven's machine or a manually triggered GitHub Actions job; all other work runs against fixtures.
- [The deployment VM may be blocked or rate limited by the AER] → The seed snapshot keeps the server useful; fall back to the nightly baked-image option in decision 2.
- [Plan shapes the normaliser misreads would produce wrong prices later] → Golden-file tests on real fixtures across every `pricingModel` seen, and the `understood` flag excludes doubtful plans from cost estimates.
- [Retailer slugs change or new retailers appear] → The seven-day failure report, plus a quarterly task to re-read the AER list.
- [Rule 2.6 was read in the February 2020 Rules] → Task 5.1 re-checks the current compilation before the tools change ships.
- [Memory growth if business plans are added later] → The store interface hides the storage choice, so SQLite can replace it.

## Open Questions

- The largest `page-size` the API accepts (the proof of concept used 100). It only affects the number of list calls.
- Whether Victorian plans appear under the same retailer paths or need extra brands. Task 1.2 answers it from fixtures; it changes only the retailer list.
