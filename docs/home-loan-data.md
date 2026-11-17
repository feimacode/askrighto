# Home loan data

Status 17 Nov 2026: implemented against synthetic fixtures only. **No live lender payload has been read** (the build workspace could not reach CDR hosts), so everything marked unverified below must be checked in the first real load (`add-home-loan-data` tasks 1.x and 8.1). Research: [home-loans-research.md](home-loans-research.md).

## Source and reuse

- Each lender's CDR banking product reference data (Get Products, Get Product Detail), no authentication. Reuse basis in `docs/data-rights.md` as `home-loans-cdr`: `cleared_pending_legal_view`.
- RBA cash rate target, entered by hand from the RBA page with its link (`npm run build && node dist/askrighto.js homeloans:cash-rate --date YYYY-MM-DD --value 3.60 --source https://www.rba.gov.au/...`), attribution "Source: Reserve Bank of Australia". Dataset `rba-cash-rate`. No other RBA series is used.
- Not used: comparison sites, lender web pages (links only), RBA tables F5 and F6.

## Shapes read (dsb-schema-tools 1.35.0)

List `BankingProductV6` (`x-v` 4), detail `BankingProductDetailV7` (`x-v` 7), rates `BankingProductLendingRateV3`. The `x-v` numbers are **unverified** by analogy with energy; `src/homeloans/client.ts` holds them. See `normalise.ts` for what is read; unknown shapes are kept in `raw` and the product is flagged `understood = false` (not compared, not calculated). Flags: `rate:not_a_fraction`, `rateType:<x>`, `fixedRate:no_term`, `tier:unknown_unit`, `rates:none`, `category:possible_construction_or_reverse`, `comparisonRate:not_a_fraction`.

Percent convention: a `RateString` is a fraction, so `0.0599` is 5.99%. Rates above 1 are not understood and flagged rather than guessed. Pin this against a real lender page in the first load (task 4.3).

## Lender list

`src/homeloans/lenders.json` is empty. Seed it from the CDR Register's Data Holder Brands Summary API (URL, version header and fields **unverified**) and review it in a pull request. Each entry: `slug`, `brandName`, `baseUri` (public base, without `/cds-au/...`), `active`. `check:lenders` (Register vs file vs live response) is not built yet.

## Tables (migration 0006)

`home_loan_lenders`, `home_loan_products` (key lender + product id; `detail` normalised, `raw` as received), `home_loan_changes`, `home_loan_sync_runs`, `reference_rates`.

## Refresh

- `npm run homeloans:sync` (first load, `--record DIR` saves raw responses as fixtures, `--lender SLUG` for one lender). The server's daily timer (03:30 Australia/Sydney, `ASKRIGHTO_HOME_LOAN_SYNC_AT`) only runs after data was loaded once.
- Per lender: list current residential mortgages, fetch detail for new or changed products, re-verify about one seventh of the rest daily, remove withdrawn products, one transaction per lender, advisory lock. A failing lender keeps its products and their old `verified_at`; tools report that time as the as-of date.
- Request pacing: 2 a second per lender, 8 in flight overall (`ASKRIGHTO_SYNC_PER_RETAILER_RPS`, `ASKRIGHTO_SYNC_MAX_IN_FLIGHT`). Real lender limits are unknown.
- `npm run report:homeloans` prints coverage and freshness and exits non-zero on problems.

## Settings

- `ASKRIGHTO_VERTICALS=...,home-loans` loads the vertical; leave it out of `ASKRIGHTO_PUBLIC_VERTICALS`.
- `ASKRIGHTO_HOME_LOAN_TOOLS=a,b` limits registered tools (for example to ship the calculator dark).
- `ASKRIGHTO_HOME_LOAN_EXCLUDE=slug1,slug2` removes lenders from every result at once; the coverage block counts them.
- `ASKRIGHTO_HOME_LOAN_LEGAL_FILE` overrides the legal marker path (default `docs/legal/home-loans-view.md`).

## Differences from the proposal

- The shared CDR code moved to `src/cdr/` (HTTP core and limiter); energy uses it with its tests unchanged. The sync loop itself is still a separate copy in `src/homeloans/sync.ts`.
- Home loans have their own `home_loan_sync_runs` table rather than a `vertical` column on `sync_runs`.
- Not built: `check:lenders`, Inkview widgets (tools return markdown), `ongoing_fees` sort (the fee period is not stored yet).

## Findings from a real run (2026-11-17, 12 lenders)

- The Register brands list works with `x-v: 2` and gives each brand's `publicBaseUri`.
- Product list: 8 of 12 lenders need `x-v: 5` and answer 406 to 4 (CBA, Westpac, ANZ, ING, Bendigo, Great Southern, Teachers Mutual, Beyond). NAB, Macquarie, BOQ and Unloan accept 4. The client now tries 5, then 4, then 3, and remembers the answer per lender. Product detail at `x-v: 7` worked everywhere.
- Rates are fractions (0.0714 is 7.14%); some lenders send 16-decimal strings. Fixed terms were ISO durations (`P1Y`, `P2Y`, `P60M`).
- Tier bounds are strings for most lenders and JSON numbers for Great Southern; both are now read.
- ING adds a `DOLLAR` "Total borrowing" tier. Great Southern's `DISCOUNT` rates have no comparison rate. NAB publishes a minimum and a maximum advertised rate for the same product and LVR band. One Unloan comparison rate was below its own rate.
- Not yet handled: margin-style `DISCOUNT` entries, purpose or repayment stated only in free text, and a comparison rate below the rate (to be flagged).
