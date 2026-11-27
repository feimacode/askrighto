# Design

## Flow

`list_home_loan_lenders` reads the Register brand list (`GET https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary`, `x-v: 2`, confirmed 200 on 27 Nov 2026), keeps brands in the banking industry whose `publicBaseUri` passes the checks below, and caches the list in memory for six hours. `get_home_loan_products` resolves a lender (brand id, or a name matching exactly one brand; otherwise `needs_input` with the candidates), then requests:

- list: `{base}/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES&page=N&page-size=M` (page size capped at 25), trying `x-v` 5, 4, 3 and moving on only after a 406.
- detail: `{base}/cds-au/v1/banking/products/{productId}`, trying `x-v` 7, 6, 5.

All requests send `x-min-v: 1`, an identifying `User-Agent` (`AskRighto/<version> (+https://askrighto.feimacode.com)`) and no caller headers. A 27 Nov test of CommBank, NAB and Westpac found these versions work.

## Safety

- Base URIs must be `https`, with no credentials, no port, a dotted DNS name, and not an IP literal or `localhost`. Redirects are refused. A product id must match `[A-Za-z0-9._~:-]{1,128}`.
- Per-lender pacing through the existing `RetailerLimiter` (2 requests a second, 8 in flight overall), 15 second timeout, response size capped at 2 MB.
- Nothing from a lender response is written anywhere. The access log keeps no arguments. No product cache (Rule 3).
- The tool returns the lender body unmodified under `lenderResponse`, plus the lender endpoint, version used and fetch time, so every figure traces to the lender (Rule 1).

## Results

`found` with `source` = the lender endpoint, `asOf` = fetch time, notice that the figures are the lender's as published, not Ask Righto's, general information only. `not_found` / `data_unavailable` for a lender that is unreachable, a lender that rejects every version, or a body that is not CDR JSON.

## Risks

- Credit law: serving lender data live is still a credit product comparison tool for rule 5, so the vertical stays internal and the dataset is `cleared_pending_legal_view`.
- Lender load: low per-request, but anyone with the internal token can drive it; the global per-client limiter applies.
