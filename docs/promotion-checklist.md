# Promotion checklist

A vertical is added to `ASKRIGHTO_PUBLIC_VERTICALS` only through a pull request (or infra change) that records every gate below. Rollback is removing it from the list and redeploying.

For `courses-domestic`, copy this list into the promotion pull request and tick each line with evidence.

1. **Rights cleared.** Every dataset the vertical reads is `cleared` in `src/core/rights.json`, with no `cleared_pending_legal_view` left. `npm run release:check` passes and lists no pending legal view.
2. **Review-by dates current.** No served dataset is past its `reviewBy`; terms pages were re-read and the read dates updated.
3. **Launch criteria met.** For courses: the host test prompts pass in Claude and ChatGPT, including guided browsing of a course page, "will I get into Monash Medicine?" and "which subjects should I pick?". Minors and privacy checks from the listing changes are done.
4. **Two weeks of internal counts.** `/metrics-internal/<token>` shows no unexplained `data_unavailable` or error spikes for two weeks.
5. **Iven's explicit go, in writing.**

## home-loans: index-only

Home loans store no lender data (27 Nov 2026), so the credit legal-view gate, dataset clearance, `report:homeloans` and the legal marker file are retired. Before listing, still run: the host test that the assistant can fetch CDR product lists with the `x-v` header (`docs/home-loan-data.md`), the prompt set in `docs/home-loan-evaluation/prompts.md` on each host, and a check that listing text says Ask Righto gives information only and holds no lender data.

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
