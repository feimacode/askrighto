## Why

Trust is the main objection to AI answers, and health cover adds tax maths, a high-risk directory category and a regulatory fence. Before the vertical leaves the internal route we need a fixed prompt set, a repeatable check that figures trace to tools, and written promotion gates that include the health-specific ones: rule currency after each 1 April and 1 July, the legal view, and a premium file that is not older than the last premium change. This follows `add-course-use-case-comparison` and reuses its tooling.

## What Changes

- A health section for the coverage report (`compare:usecases` gains a `health-cover` case): insurers and products loaded, share of products with a published premium, share with a stated after-rebate premium, age of the file, age of each rule row, and rights status of both datasets.
- A fixed set of about 20 prompts in `docs/use-case-comparison/health-prompts.md`: product search, category match, comparison, premium after rebate, surcharge test, loading, rule lookup, a proposed-change question, and edge and refusal cases (best policy, should I switch, medical condition volunteered, general insurance, overseas student cover, income outside stored rules, unknown product).
- A scorecard with health-specific checks (disclosure present, no banned phrase, no directive on the surcharge, insurer's quote line present, proposed change not used as a number).
- Draft promotion gates for `health-cover`, added to `docs/promotion-checklist.md`, which Iven confirms or changes.
- Extension of the maintainer answer-review skill with the health banned list and number trace rules.

Hosts affected: Claude, ChatGPT and Gemini (manual runs against the internal route). Data: reads our own tables only; no new source.

Out of scope: automatic scoring of model text, real user questions, any public listing step itself (the promotion pull request, after Iven's go), the legal view itself (a person outside this repo).

## Capabilities

### New Capabilities
- `health-cover-evaluation`: coverage report, prompt set, scorecard and promotion gates for the health cover vertical.

### Modified Capabilities
None. Extends the `add-course-use-case-comparison` tooling with a health case but does not change its requirements.

## Impact

- `src/compare/` gains a health module; new docs under `docs/use-case-comparison/`; `docs/promotion-checklist.md` gains a health section; the answer-review skill gains health wording rules.
- Depends on `add-health-cover-data`, `-rates`, `-tools` and `-skills`.
