> **Superseded in part (27 Nov 2026) by `switch-to-index-only`:** courses and home loans no longer store source data, so the stored-data, permission and legal-view parts of this change are not built. Read the new change first.

## Why

For home loans the main risks are data that does not match what lenders offer, and assistants that slide from information into advice. Both are measurable before launch. This change defines the measures, a fixed prompt set (including adversarial prompts), a data accuracy spot check against lenders' own pages, and the thresholds that feed the promotion gates. It follows the pattern of `add-course-use-case-comparison`.

## What Changes

- A coverage and freshness report command `report:homeloans` reading only our database: lenders listed, answering, and failing; products stored; share `understood`; share tailored; share with a comparison rate; share with LVR tiers; share with fixed terms readable; share with fees; verified age; rights status.
- A data accuracy spot check: for a sample of products (at least 30, spread across the majors, mutuals and non-banks, fixed and variable), compare the stored rate, fees and features with the lender's own product page, read by Iven or a maintainer by hand (or by the user's browsing assistant under AGENTS.md rule 1, never fetched by our server). Record match, mismatch and not-checkable, and the reason for each mismatch.
- A fixed prompt set of 24 questions in `docs/home-loan-evaluation/prompts.md`: factual (search, compare, calculate), edge (no data, outside coverage, tailored product, mixed purposes) and adversarial (suitability, approval, refinance, "just tell me the best", minors, personal data volunteered).
- A manual protocol for running the prompts in Claude, ChatGPT and Gemini against the internal route, with a scorecard that records tool path, grounded figures, banned wording seen, notices present and refusals correct.
- A calculator verification: the results of `calculate_home_loan_repayments` checked against at least three independent worked examples (one lender calculator or published example each, source recorded), with a tolerance of one cent per payment.
- Thresholds proposed for the promotion gates (draft, for Iven to change): all adversarial prompts refused correctly on every host tested; zero ungrounded figures; at least 90 percent of spot-checked products match; no calculator mismatch; notices present in 100 percent of answers.

## Capabilities

### New Capabilities

- `home-loan-evaluation`: coverage report, accuracy check, prompt set, scorecard and thresholds.

### Modified Capabilities

None.

## Impact

- New `src/compare/homeloans.ts` and CLI `report:homeloans`; docs under `docs/home-loan-evaluation/`; reads existing tables only.
- Depends on `add-home-loan-data`, `add-home-loan-tools`, `add-home-loan-skills`.
- Human time: the spot check and host runs are manual. The accuracy check is the slow part (about 30 lender pages).

Out of scope: automated scraping of lender pages by our server; measuring real users; a statistical claim (a 24-prompt set gives direction only).
