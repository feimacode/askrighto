> **Superseded in part (27 Nov 2026) by `switch-to-index-only`:** courses and home loans no longer store source data, so the stored-data, permission and legal-view parts of this change are not built. Read the new change first.

## Why

AGENTS.md rule 5 and the ROADMAP park credit comparison until "a legal view or a licensed partner". The home loan vertical can still be built and tested internally, but nobody has said what that rule permits before the view exists, and public listing needs clear, checkable gates. This change makes the line explicit in code and in the promotion checklist, so the vertical cannot reach the public route by accident.

## What Changes

- Add a `home-loans` section to `docs/promotion-checklist.md` with gates specific to credit: legal view recorded (with the seven questions in `docs/home-loans-research.md`), data accuracy check passed, calculator verified, adversarial prompts passed on every listed host, notices approved by the legal view, two weeks of internal counts, Iven's written go.
- Add a rights status `blocked_pending_legal_view` semantics for home loan datasets (reuse `cleared_pending_legal_view`) and make `npm run release:check` fail if `home-loans` is in `ASKRIGHTO_PUBLIC_VERTICALS` while any of its datasets is not `cleared`.
- Add a start-up refusal: in production, naming `home-loans` in `ASKRIGHTO_PUBLIC_VERTICALS` without a signed-off marker file (`docs/legal/home-loans-view.md` recording reviewer, date, scope) stops start-up with a clear message. The marker is evidence, not security; it prevents a settings slip.
- Add a launch-scope statement: first public release lists and compares only (no calculator) unless the legal view covers the calculator (design decision 3).
- Prepare the directory listing text drafts for Claude, ChatGPT and Gemini for this vertical (description, test cases, the "lending is higher risk" disclosures), unpublished and marked draft, so the legal view can review exact words.
- Record a decision request for Iven: whether AGENTS.md rule 5 should be reworded to "may be built and tested on the internal route; public listing needs the legal view". This change does **not** edit AGENTS.md.
- Add a retraction route: how a lender or a user reports a wrong rate (reusing the five business day corrections process in `docs/permissions/log.md`), and a "pull a lender" switch (`ASKRIGHTO_HOME_LOAN_EXCLUDE=lender-slug`) that removes a lender's products from results immediately.
- Add rollback steps (remove from the public list, redeploy) and a review date: re-read CDR terms, RBA terms and the comparison-rate rules each 1 March and 1 September.

## Capabilities

### New Capabilities

- `home-loan-release`: the gates, start-up guard, retraction route and rollback for the home loan vertical.

### Modified Capabilities

None. (`release-channels` from `add-canary-release` is extended by reference only.)

## Impact

- Edits to `docs/promotion-checklist.md`, `src/core/rights.ts` or `src/main.ts` for the guard, `scripts/release-check`, and `docs/permissions/log.md` for the corrections route; new `docs/legal/` folder with a template and `docs/listing-drafts/home-loans.md`.
- Depends on `add-canary-release` (already built) and the four home loan changes.
- No public behaviour changes until Iven promotes.

Out of scope: choosing a lawyer or paying for the legal view (Iven's); a licensed partner or referral arrangement; any revenue model; AFSL products (insurance, super), which stay parked.
