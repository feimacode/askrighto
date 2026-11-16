## Context

The two use cases differ in kind. Domestic answers depend on admissions facts that need permission and mostly come through guided browsing. International answers depend on CRICOS fields that are open but unverified. A fair comparison needs the same measures on both, measured the same way, without logging what users ask.

## Decisions

1. **Five measures per use case.**
   - Coverage: share of rows with each key fact (domestic: entry figure, prerequisite rule, curated; international: fee, duration, locations, provider link).
   - Grounding: share of prompt answers where every figure traces to a tool result or a labelled assistant-read page.
   - Completeness: share of prompts answered fully without the user's browsing assistant, versus needing it, versus not answerable.
   - Freshness: age in days of the oldest source behind an answer.
   - Rights readiness: rights status of every dataset used and whether the production gate would pass today.
2. **Data-side measures come from SQL, answer-side measures from a manual run.** The report command computes coverage, freshness and rights readiness. Grounding and completeness need a person to run the prompts and fill the scorecard. No automatic scoring of model text.
3. **Prompt sets are fixed and versioned.** About 20 per use case, mixed: lookup, filter, compare, "what does this need" and edge cases (unknown course, missing fee, index-only course, expired course). Same wording style across both so the sets are comparable. Each prompt names the expected tools.
4. **Live signal reuses canary counters.** Outcome counts per tool (`found`, `not_found`, `data_unavailable`, `needs_input`, depth) already exist. The scorecard records them before and after a test session; the difference is the run's footprint.
5. **Test hosts.** Claude, ChatGPT and Gemini, each with and without a browsing assistant, recorded in one table. Browser agents on the user's own browser are untested so far; the protocol records that as a known gap rather than assuming it works.
6. **Decision rules (draft, for Iven to confirm).** A vertical is a promotion candidate only if: rights readiness passes in production mode; at least 80 percent of prompts are answered grounded; no prompt produces an ungrounded figure; and the data is under 45 days old. The vertical with more prompts answered without the browsing assistant is promoted first, unless Iven decides otherwise. Promotion itself still follows `docs/promotion-checklist.md` and needs Iven's go.
7. **No user data.** Prompts are ours, run by us on the internal route. Nothing from real users is stored.

## Risks / Trade-offs

- A 20-prompt set is small; it gives a direction, not statistics. Say so in the scorecard.
- The international columns are unverified, so the first scorecard may show low coverage for reasons that are really about the file; the report prints the field list it found.

## Open Questions

- Are the draft thresholds (80 percent, 45 days) right?
- Which prompts should come from real student or parent questions Iven has seen?
