## Context

Energy already syncs a CDR product API into PostgreSQL (`src/energy/cdr-client.ts`, `sync.ts`, `limiter.ts`, `normalise.ts`, `store.ts`). Banking differs in four ways:

1. **Endpoint hosts are per lender**, not one routing host. The AER hosts every energy retailer under one base; for banking each brand publishes its own base URI (found through the Register). Reaching them from this cloud workspace was refused, so the host list, `x-v` values and real payloads are **unverified**.
2. **One product has many rates.** A home loan carries a list of `lendingRates`, each with its own type, purpose, repayment type, tiers and comparison rate. A "product" is not one number.
3. **Rates may be headline only.** The standards allow tiers by LVR, but whether lenders publish the discounted rate customers actually get is **unverified**. `isTailored` products say their prices are negotiated.
4. **Mixed products.** `RESIDENTIAL_MORTGAGES` may include construction, bridging or reverse loans. This is **unverified**; the normaliser must flag, not guess.

Schemas read in `dsb-schema-tools` 1.35.0 (see `docs/home-loans-research.md` section 1.2): list `BankingProductV6`, detail `BankingProductDetailV7`, rate `BankingProductLendingRateV3`, tier `BankingProductRateTierV4`, fee `BankingProductFeeV2`, feature `BankingProductFeatureV4`.

## Goals / Non-Goals

**Goals:** a current, traceable copy of published home loan products; one shared CDR sync core; nothing invented.

**Non-Goals:** ranking, calculation, advice; products other than residential mortgages; user data.

## Decisions

1. **Extract `src/cdr/` first, then add banking.** Move the HTTP client (paging via `links.next`, `x-v` headers, 429 and `Retry-After`, 5xx retry, per-host limiter, in-flight ceiling, adaptive slow-down), the sync report types and the lock helper out of `src/energy/`. Energy re-exports them so its tests and CLI keep working. Alternative: copy the files. Rejected: two clients to patch whenever a data holder misbehaves.
2. **Lender list as a checked-in file** `src/homeloans/lenders.json` (`slug`, `brandName`, `baseUri`, `legalEntity`, `active`, `lastVerified`), seeded by a script from the Register's Data Holder Brands Summary API and reviewed in a PR. The server never calls the Register at run time. A `check:lenders` command compares the file to the live Register and to each base URI's response. Non-bank lenders in the CDR are included only if the Register lists them. **Unverified:** the Register URL, its version header and whether brand records name the products endpoint.
3. **Tables** (schema `askrighto`, migration `0006`):

```
home_loan_lenders  (slug pk, brand_name, base_uri, active, last_sync_at, last_sync_ok, last_product_count, last_error)
home_loan_products (product_id, lender_slug, pk(lender_slug, product_id),
                    name, description, effective_from, effective_to, is_tailored,
                    application_uri, product_uri,       -- links only
                    understood bool, not_understood text[],
                    detail jsonb,                        -- normalised rates, fees, features, constraints
                    raw jsonb,                           -- detail payload as received
                    detail_hash, source_last_updated, fetched_at, verified_at)
home_loan_changes  (id pk, lender_slug, product_id, changed_at, source_last_updated, detail_hash, silent bool)
reference_rates    (series text, effective_date date, value_pct numeric, source_url, fetched_at, pk(series, effective_date))
sync_runs          reuse the existing table with a `vertical` column added
```

Product ids are only unique within a lender, so the key is the pair.

4. **Normalised model.** Rates are kept as exact decimal strings plus a numeric copy for sorting; the string shown to users is the published one. Percent values from the source are fractions or percent according to the standards' `RateString` type, where `0.05` means 5 percent; the normaliser converts once and a test pins it. **Unverified** on real payloads.

```ts
type HomeLoanProduct = {
  lenderSlug: string; productId: string; brandName: string; name: string; description: string;
  rates: LoanRate[];            // one per lendingRates entry, never merged
  fees: LoanFee[]; features: string[]; constraints: LoanConstraint[]; eligibility: string[];
  isTailored: boolean; effectiveFrom?: string; effectiveTo?: string;
  links: { product?: string; apply?: string; feesAndTerms?: string[] };
  understood: boolean; notUnderstood: string[];
  sourceLastUpdated: string; fetchedAt: string; verifiedAt: string;
};
type LoanRate = {
  type: "VARIABLE"|"FIXED"|"INTRODUCTORY"|"DISCOUNT"|"BUNDLE_DISCOUNT_FIXED"|"BUNDLE_DISCOUNT_VARIABLE"|"OTHER";
  rate: string;                 // as published
  comparisonRate?: string;      // as published, never recomputed
  purpose: "OWNER_OCCUPIED"|"INVESTMENT"|"OTHER"|"UNCONSTRAINED";
  repayment: "PRINCIPAL_AND_INTEREST"|"INTEREST_ONLY"|"OTHER"|"UNCONSTRAINED";
  fixedTerm?: string;           // ISO duration read from additionalValue when type is FIXED
  tiers: { unit: "PERCENT_LVR"|"DOLLAR"|"MONTH"|"DAY"; min: string; max?: string; method?: string }[];
  conditions: string[];         // applicabilityConditions and additionalInfo text, kept verbatim
};
```

5. **Understood flag.** A product is `understood: false` (kept, flagged, not compared) when any rate has a type we do not map, tiers in an unknown unit, a fixed rate with no readable term, or a category mismatch (reverse, construction). Reasons are listed, as energy does.
6. **Residential only.** List calls pass the product category filter if the endpoint supports it; otherwise filter on `productCategory`. Business and investor-only commercial loans are dropped; investor residential loans are kept and labelled by purpose.
7. **Sync policy.** Same as energy: list every active lender, fetch detail for new or changed `lastUpdated`, re-verify a rolling seventh of the rest daily, remove withdrawn products, one transaction per lender, advisory lock, per-lender rate cap (start 2 a second, one in flight). Run at 03:30 Australia/Sydney, an hour after energy.
8. **RBA cash rate.** One small job reads the RBA's published cash rate target (source page and format **unverified**; first task is to find a stable machine-readable source), stores date, value and URL, and the tools quote it with "Source: Reserve Bank of Australia" and the effective date. No other RBA series.
9. **Grounding.** Each stored product keeps `source` (the lender's CDR product URL and the lender's own product page link), `source_last_updated` and `verified_at`. The `asOf` a tool reports is `verified_at`, not the sync run time, so a lender that stopped answering shows an old date rather than a fresh-looking one.

## Risks / Trade-offs

- **Published rates may not match what a customer is offered** (headline vs discounted, tailored products, LVR tiers). Mitigation: store tiers and conditions verbatim, surface `isTailored`, and run the accuracy spot check in `add-home-loan-evaluation` before anything is public.
- **Per-lender endpoint quirks** (base paths, header versions, a lender serving a retired version). Mitigation: shared client, per-lender report, `docs/cdr-schemas.md` guidance on older versions.
- **Refactor risk to energy.** Mitigation: land the extraction as its own commit with the energy tests unchanged.
- **Brand list drift** as lenders join or leave the CDR. Mitigation: `check:lenders` in the weekly timer's report.

## Open Questions

- Do non-bank lenders that sit in the CDR publish product data the same way, and are they in the Register's brand list?
- Does any lender restrict or refuse automated product requests despite the rules? Observe in the first load.
- Is the cash rate available as a stable CSV or API, or must it be re-keyed by hand with a link? (Re-keying a published number with its source is acceptable under the same own-words approach as course facts.)
