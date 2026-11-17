## Context

The rights gate already blocks serving datasets that are not `cleared` in production, and `cleared_pending_legal_view` blocks public listing (see `docs/data-rights.md`). Courses have a promotion checklist. Credit adds a regulatory gate that is not about data rights, so a dataset status alone is too weak: the data is open under the CDR, yet the activity may need a licence.

## Decisions

1. **Two guards.** (a) `release:check` fails if `home-loans` is public and any home loan dataset is not `cleared`; (b) production start-up refuses a public `home-loans` without `docs/legal/home-loans-view.md` in the image. Alternative: a feature flag only. Rejected: a flag can be flipped in feima-infra by mistake without anyone reading the gates.
2. **The marker file is evidence, not law.** It records the reviewer's name and firm or role, the date, the scope covered (listing, comparison, calculator) and any conditions. The guard reads only that the file exists and names a scope; it cannot judge it. The check that scope covers the calculator is a step in the checklist.
3. **Launch scope can be narrower than the code.** The calculator tool can be shipped dark: `ASKRIGHTO_HOME_LOAN_TOOLS` lists enabled tool names, defaulting to all on the internal route and to the scope named in the marker file on the public route. Only enabled tools are registered.
4. **Gate list** (for `docs/promotion-checklist.md`):
   1. Legal view done for the scope being listed, answers to the seven questions recorded, notices text approved.
   2. All home loan datasets `cleared`; review-by dates current; CDR operative rule number recorded.
   3. Evaluation thresholds met (`add-home-loan-evaluation`): accuracy check, calculator check, prompt set on each listed host.
   4. Two weeks of internal counts with no unexplained `data_unavailable` or error spikes; at least 10 lenders answering daily.
   5. Directory listing text matches the approved wording; screenshots show the notices.
   6. Corrections route staffed (who reads reports) and the pull-a-lender switch tested.
   7. Iven's explicit go, in writing.
5. **Retraction route.** A wrong rate report goes to the corrections address; the target is five business days (as courses), but a confirmed wrong rate removes the lender or product within one business day via `ASKRIGHTO_HOME_LOAN_EXCLUDE`. The exclusion list is applied at read time so no resync is needed.
6. **Listing drafts.** Directory text for credit-related tools gets the strictest reading (Claude lists lending among higher-risk areas for finance; confirm the exact category text, **unverified**). Drafts live in `docs/listing-drafts/home-loans.md`, never auto-submitted.
7. **Rule 5 wording.** Reading rule 5 literally ("stay out") could forbid internal work. This change takes the narrower reading (public listing and any user-facing advice stay out) and asks Iven to confirm or reword. Alternative: treat it as forbidding the build entirely. Rejected: the coordinator asked for proposals, and the internal route exists for exactly this kind of test.
8. **Review dates.** Rights entries carry `reviewBy` (1 March and 1 September); `overdueReviews` already warns, and the gate fails when overdue.

## Risks / Trade-offs

- A marker file could be added without a real legal view. Mitigation: the checklist requires the reviewer's name and Iven's written go; the guard only stops accidents.
- Excluding a lender hides it from comparisons without a visible reason. Mitigation: the coverage block counts excluded lenders and says "removed pending a data check".
- Narrow launch scope reduces usefulness. Mitigation: it can widen when the legal view covers more.

## Open Questions for Iven

1. Confirm the narrower reading of AGENTS.md rule 5 (internal build and test allowed), and whether to reword the rule.
2. Who gives the legal view, and does it cover credit and the CDR together or in separate engagements?
3. Is a licensed partner (credit representative or broker referral) a path you want to keep open? It would change the no-referral stance and rule 4.
