# Home loan data (index-only)

Since 27 Nov 2026 (`switch-to-index-only`) Ask Righto stores no home loan data: no lender products, rates or fees, and no RBA cash rate. The sync, store, normaliser and the search, get, compare and reference-rate tools are gone, as are the `homeloans:*` commands. Migration 0011 drops `home_loan_*` and `reference_rates`.

What exists: `get_cdr_banking_guide` (links to the CDR Register and standards, product endpoints, version headers, object structure, quirks, wording rules; content in `src/homeloans/guide.ts`) and `calculate_home_loan_repayments` (arithmetic on a rate the user or assistant gives, no data). The assistant fetches from the lenders and quotes each figure with lender, link and time read.

## Feasibility risk, tested 27 Nov 2026 (task 1.1, FengsPC, curl, CommBank, NAB, Westpac)

A plain URL fetch does not work. With no `x-v` header all three lenders answer HTTP 400 (`Header/Missing`, no products), with a normal or browser-like User-Agent alike; no bot check was seen. With `x-v: 5` the product list returns 200 for all three; CommBank and Westpac answer 406 to 4 and 3, NAB accepts 4 or 5. Product detail returns 200 at `x-v: 7` for all three and 400 without a header. CommBank and Westpac name their current version in the error's `x-v` response header; NAB sends none. The Register brands API path (`https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary` with `x-v: 2`) returned 200 with `publicBaseUri` for each brand.

So an assistant must be able to send custom headers (a code sandbox, or a fetch tool that allows them). Not yet tested: whether Claude, ChatGPT and Gemini can do so. If a host cannot, the skill gives the lender's own page. Fallbacks if no host can: a header-adding pass-through endpoint on our server (fetches and returns, stores nothing; more legal surface) or dropping home loans from those hosts. Neither is built.

## Research notes

Research and the earlier credit-law questions: [home-loans-research.md](home-loans-research.md). Shapes read: dsb-schema-tools 1.35.0 (list `BankingProductV6`, detail `BankingProductDetailV7`, rates `BankingProductLendingRateV3`).

## Findings from a real run (2026-11-17, 12 lenders), now the guide's quirks

- The Register brands list works with `x-v: 2` and gives each brand's `publicBaseUri`.
- Product list: 8 of 12 lenders need `x-v: 5` and answer 406 to 4 (CBA, Westpac, ANZ, ING, Bendigo, Great Southern, Teachers Mutual, Beyond). NAB, Macquarie, BOQ and Unloan accept 4. The client now tries 5, then 4, then 3, and remembers the answer per lender. Product detail at `x-v: 7` worked everywhere.
- Rates are fractions (0.0714 is 7.14%); some lenders send 16-decimal strings. Fixed terms were ISO durations (`P1Y`, `P2Y`, `P60M`).
- Tier bounds are strings for most lenders and JSON numbers for Great Southern; both are now read.
- ING adds a `DOLLAR` "Total borrowing" tier. Great Southern's `DISCOUNT` rates have no comparison rate. NAB publishes a minimum and a maximum advertised rate for the same product and LVR band. One Unloan comparison rate was below its own rate.
- Not yet handled: margin-style `DISCOUNT` entries, purpose or repayment stated only in free text, and a comparison rate below the rate (to be flagged).
