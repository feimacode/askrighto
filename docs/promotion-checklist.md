# Promotion checklist

A vertical is added to `ASKRIGHTO_PUBLIC_VERTICALS` only through a pull request (or infra change) that records every gate below. Rollback is removing it from the list and redeploying.

For `courses-domestic`, copy this list into the promotion pull request and tick each line with evidence.

1. **Rights cleared.** Every dataset the vertical reads is `cleared` in `src/core/rights.json`, with no `cleared_pending_legal_view` left (the legal view on re-keyed course facts is done). `npm run release:check` passes and lists no pending legal view.
2. **Review-by dates current.** No served dataset is past its `reviewBy`; terms pages were re-read and the read dates updated.
3. **Launch criteria met.** For courses: the agreed curation depth is reached, and the host test prompts pass in Claude and ChatGPT, including guided browsing of an index-only course, "will I get into Monash Medicine?" and "which subjects should I pick?". Minors and privacy checks from the listing changes are done.
4. **Two weeks of internal counts.** `/metrics-internal/<token>` shows no unexplained `data_unavailable` or error spikes for two weeks.
5. **Iven's explicit go, in writing.**

## home-loans (credit): extra gates

`home-loans` is internal-only. Production start-up refuses to run it publicly without `docs/legal/home-loans-view.md`, and `npm run release:check` fails if it is public while a home loan dataset is not `cleared`. Copy this list into the promotion pull request with evidence for each line.

1. **Legal view recorded** for the scope being listed (listing, comparison, calculator), the seven questions in `docs/home-loans-research.md` answered, the notice wording approved and copied into `src/homeloans/notices.ts`. The marker file is added in this pull request.
2. **Datasets cleared.** `home-loans-cdr` and `rba-cash-rate` are `cleared`, review dates current, and the operative CDR rule number is recorded in `docs/data-rights.md`.
3. **Evaluation thresholds met** (draft thresholds in `docs/home-loan-evaluation/thresholds.md`, awaiting the owner's decision): accuracy check, calculator check, prompt set on every listed host.
4. **Two weeks of internal counts** with no unexplained `data_unavailable` or error spikes, and `report:homeloans` showing at least 10 lenders answering.
5. **Listing text** matches the approved wording (`docs/listing-drafts/home-loans.md`).
6. **Corrections route staffed** (who reads wrong-rate reports) and `ASKRIGHTO_HOME_LOAN_EXCLUDE` tested on the live instance.
7. **Public tools set** to the scope the marker covers via `ASKRIGHTO_HOME_LOAN_TOOLS`.
8. **Iven's explicit go, in writing.**
