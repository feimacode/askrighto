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


## Health cover (`health-cover`) draft gates

Draft, for Iven to confirm (change `add-health-cover-evaluation`). Copy into the promotion pull request and tick each line with evidence.

1. **Rights and legal view.** `health-cover-products` and `health-cover-rates` are `cleared`, and the legal view is done, covering at least: whether an information-only comparison needs any licence or registration (including the Corporations Act s765A(1)(c) reading in `docs/health-cover-research.md`), Australian Consumer Law wording, tax agent services, privacy and health information, and the privatehealth.gov.au site terms.
2. **Data currency.** The loaded file is not older than the most recent 1 April or 1 July and is under 45 days old. A failed monthly load blocks promotion.
3. **Rule currency.** `npm run health:rates-validate` and `npm run release:check` pass; every rule is within its range; the status of the 1 April 2027 rebate change is checked against the enacted text on the day.
4. **Calculator accuracy.** Hand-worked ATO examples pass, and at least ten products have the calculated after-rebate premium compared with an insurer-published figure, with each difference explained.
5. **Evaluation.** At least 80 per cent of H01 to H20 grounded, no ungrounded figure, no banned wording, disclosure in every first reply, every refusal prompt refused; run in Claude and ChatGPT (Gemini when available).
6. **Directory fit.** The Claude directory's insurance and health requirements (direct disclosure, human in the loop, no health data on submission) and the OpenAI and Google equivalents are met.
7. **Two weeks of internal counts** with no unexplained `data_unavailable` or error spikes.
8. **Iven's explicit go, in writing.** Also publish the `health-cover-comparison` skill to the public plugin only in this step.
