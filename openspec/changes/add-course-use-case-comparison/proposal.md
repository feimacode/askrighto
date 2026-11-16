## Why

Iven wants to compare two uses of the same course tooling: the domestic VCE/curated finder and the CRICOS-based international finder (16 Nov 2026). Without agreed measures the comparison will be impressions. This change defines the measures, a fixed set of test questions for each use case, a repeatable data-coverage report, and the decision rules for which to promote first.

## What Changes

- A coverage report command `compare:usecases` that reads only our own database and prints, per use case: rows loaded, share of rows with each key fact, share `curated` versus `index_only` (domestic), data age, and rights status.
- A fixed prompt set of about 20 questions per use case in `docs/use-case-comparison/prompts.md`, each with the expected tool path and what a correct, grounded answer must contain.
- A manual test protocol for running the prompts through host assistants (Claude, ChatGPT, Gemini) against the internal route, with a scorecard template.
- Use of the existing metadata-only canary counters (outcome per tool) as the live signal; no new tracking and no user data.
- Decision rules: what the scorecard must show before either vertical is considered for the public route, tied to `docs/promotion-checklist.md`.

## Capabilities

### New Capabilities
- `use-case-comparison`: coverage report, prompt sets, scorecard and decision rules for comparing the domestic and international course use cases.

### Modified Capabilities
None.

## Impact

- New `src/compare/` module and CLI `compare:usecases`, new docs under `docs/use-case-comparison/`.
- Depends on `add-intl-course-data` and `add-intl-course-tools` for the international side; the domestic side already exists.
- Reads existing tables only; writes nothing.
