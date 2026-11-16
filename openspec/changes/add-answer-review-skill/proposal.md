# Proposal

## Why

`add-course-use-case-comparison` defined 20-prompt sets and a scorecard, run by hand. Promotion gates and skill changes both need the same check repeated. A maintainer skill turns the protocol into a repeatable run.

## What Changes

- Add `ask-righto-answer-review`, a maintainer skill kept in the repo's `.claude/skills/` (not in the shipped plugin): runs a prompt set against a host, checks each answer for sourced facts, source and as-of date, no invented numbers and no banned wording, and fills the scorecard.
- Add a small checker script that flags numbers in an answer that do not appear in the tool results.

Out of scope: automated hosts, scoring thresholds beyond those already drafted.

## Capabilities

### New Capabilities

- `answer-review`: the review workflow and the number-trace checker.

### Modified Capabilities

None.

## Impact

- New files under `.claude/skills/ask-righto-answer-review/` and `scripts/`.
- Reuses `docs/use-case-comparison/`.
