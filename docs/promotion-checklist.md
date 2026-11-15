# Promotion checklist

A vertical is added to `ASKRIGHTO_PUBLIC_VERTICALS` only through a pull request (or infra change) that records every gate below. Rollback is removing it from the list and redeploying.

For `courses`, copy this list into the promotion pull request and tick each line with evidence.

1. **Rights cleared.** Every dataset the vertical reads is `cleared` in `src/core/rights.json`, with no `cleared_pending_legal_view` left (the legal view on re-keyed course facts is done). `npm run release:check` passes and lists no pending legal view.
2. **Review-by dates current.** No served dataset is past its `reviewBy`; terms pages were re-read and the read dates updated.
3. **Launch criteria met.** For courses: the agreed curation depth is reached, and the host test prompts pass in Claude and ChatGPT, including guided browsing of an index-only course, "will I get into Monash Medicine?" and "which subjects should I pick?". Minors and privacy checks from the listing changes are done.
4. **Two weeks of internal counts.** `/metrics-internal/<token>` shows no unexplained `data_unavailable` or error spikes for two weeks.
5. **Iven's explicit go, in writing.**
