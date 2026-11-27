# Proposal

## Why

The 27 Nov 2026 test (task 1.1 of `switch-to-index-only`) showed that lenders reject a plain URL fetch: every product request needs an `x-v` version header, and CommBank and Westpac answer 406 to older versions. A browsing assistant that can only fetch URLs cannot read the data, and each host differs in whether it can send headers. Iven (27 Nov 2026) asked for a simple proxy to make the host agent simpler.

## What Changes

- Add two read-only tools for the `home-loans` vertical:
  - `list_home_loan_lenders`: banking brands from the CDR Register, with their public base URIs, filtered by name.
  - `get_home_loan_products`: one lender's residential mortgage list (paged), or one product's detail, fetched live from the lender with the right `x-v` header and returned as the lender sent it, with the lender URL, the version used and the time fetched.
- The server only relays. It stores nothing from the lender in the database or on disk, keeps no product cache, and does not log arguments. The only thing held in memory is the Register brand list, for six hours.
- Fixed request shape: only the two CDR product paths on a base URI that came from the Register; no caller-supplied URL or header reaches a lender.
- This partly reverses the `switch-to-index-only` decision that the assistant fetches from lenders itself: for home loans the server fetches on the user's behalf, because headers cannot be sent from every host. CDR Rules rule 2.6 (a data holder must not restrict use of disclosed product data) is the basis; the credit legal view still blocks any public listing (AGENTS.md rule 5).
- `get_cdr_banking_guide` stays, now saying to use the proxy tools first and to fall back to reading from the lender only if a host can send headers.

Hosts affected: internal route only (Claude and ChatGPT developer mode); the public route stays energy only.

Data source: lenders' CDR product reference data and the CDR Register brand list. Licence basis: CDR Rules (product data disclosed without conditions on use). Refresh: none, live per request.

Out of scope: storing or caching lender products, ranking, a comparison tool, any non-CDR page, any endpoint outside residential mortgage product data, other banking products.

## Capabilities

### New Capabilities
- `home-loan-proxy`: live relay of lender CDR home loan product data.

### Modified Capabilities
- `home-loan-guidance`: the guide points to the proxy first.

## Impact

- New: `src/homeloans/proxy.ts`, two tools in `src/tools/home-loan-tools.ts`, rights entry `cdr-banking-live` (`cdr_rule`, `cleared_pending_legal_view`), tests with a mock lender.
- Changed: guide, instructions, skill, `scripts/release-check.mjs` (public listing blocked while the dataset awaits the legal view).
