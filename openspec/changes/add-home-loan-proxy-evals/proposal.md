# Proposal

## Why

`add-cdr-home-loan-proxy` (PR #101) made the server read lenders' CDR home loan data live. The evaluation set, written for the index-only design, still expects `get_cdr_banking_guide`, says the data is unavailable in the runner, and has no check that nothing is stored. Iven (27 Nov 2026) asked for evals for the proxy.

## What Changes

- Prompt set version 2: H01 to H31 for the proxy tools, with mechanical checks, new prompts for ambiguity, freshness, partial pages, no storage and a caller-supplied address.
- Number trace: a lender fraction (0.0599) may appear as a percentage (5.99), moved two places exactly; nothing else is relaxed.
- Proxy tests: detail version fallback, headers, fixed paths, no cache, non-CDR body, size cap, unreachable lender and Register, paging clamps, and a nothing-stored test.
- A live check (`npm run homeloans:live-check`, and a manual workflow): the real Register and three lenders, about seven requests.
- Docs: `docs/evals.md`, protocol and proposed thresholds updated.

Data source: none stored. Out of scope: any schedule for the live check (it calls lenders; not run on a timer without Iven's decision), a mock-lender prompt run, hosts other than what the protocol already names.

## Capabilities

### Modified Capabilities
- `home-loan-evaluation`: the prompt set, checks and live check cover the proxy.

## Impact

`docs/home-loan-evaluation/`, `docs/evals.md`, `scripts/trace-numbers.mjs`, `scripts/evals/lib.mjs` (comment), `.github/workflows/` (comment, one new manual workflow), `package.json`, `test/homeloans/`.
