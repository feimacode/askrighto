# Comparison protocol

Purpose: compare the domestic VCE finder and the international CRICOS finder on the same measures (change `add-course-use-case-comparison`). Our own prompts only; no real user questions are stored.

## Set-up

1. Load both data sets in a test database (`courses:load`, `vce:load`, `intl:load`). Note the CRICOS file date.
2. Start the server with `ASKRIGHTO_VERTICALS=energy,courses-domestic,cricos`, `ASKRIGHTO_INTERNAL_TOKEN` set, and neither new vertical public.
3. Connect each host (Claude, ChatGPT, Gemini) to `/mcp-internal/<token>`.
4. Run `npm run compare:usecases` and keep the output: this is the coverage, freshness and rights readiness part of the scorecard.

## Per prompt run

1. Read `/metrics-internal/<token>` and note the outcome counts for the tools in the prompt's row.
2. Paste the prompt into a fresh chat. Do not add facts the prompt does not hold.
3. Read the answer against the "grounded answer must" column. Mark each figure as traced to a tool result, read by a browsing assistant and labelled, or ungrounded.
4. Record whether a browsing assistant was used (and which), the tools called, and the outcome count difference.
5. Score: **grounded** yes only if every figure traces and the required items are present; **completeness** as answered without browsing, answered with browsing, or not answerable.

## Known gaps

- Browser agents on a person's own browser are untested against the university and provider pages. Record what happens; do not assume it works.
- A 20-prompt set gives a direction, not statistics.
- The international columns are unverified until `docs/cricos-columns.md` is filled in, so early coverage numbers may reflect the file rather than the product.
