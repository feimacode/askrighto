# Proposal

## Why

`compare_energy_plans` returns a lot more than a host can use. In a 25 Nov 2026 hand-run of the hosted connector, a request for 3 plans came back at about 30,000 characters: 3 estimates, 3 conditional-discount rows, and a `notEstimated` list of more than 40 plans, each with a full sentence of detail. The 40-odd entries are the bulk. They say "needs time-of-use split" or "demand charge", and most of them say it the same way.

A host that carries several of these in one chat has less room for the things it must keep: the postcode, the plan id and the usage. The drift tests on `main` found no case where a tool argument was lost because of size, so this is a risk, not an observed failure. It is cheap to remove, and it keeps the answer easier for the user to read.

## What Changes

- **A short `notEstimated` by default.** `compare_energy_plans` returns at most 10 entries in `notEstimated` (today up to 50), the first by rank order of the data. `counts.notEstimated` and `notEstimatedByReason` still give the full count and the reasons, so no plan is hidden: the host can say "and 31 more need a time-of-use split".
- **More on request.** A new optional `notEstimatedLimit` (0 to 50, default 10) returns more or none. A user who asks "which plans could you not estimate?" gets the full list.
- **One cap for text and data.** The text view's cap of 15 is replaced by the same limit, so the two views agree.
- **No change to the ranking.** `estimates`, `ifConditionsMet`, `current`, the counts and every figure are exactly as today.

Data source: unchanged. No figure, link or as-of date changes. Rule 1 holds because every plan the tool could not estimate is still counted, with its reasons, and any one of them can be listed on request.

Hosts affected: Claude, ChatGPT and Gemini. One new optional input; one list is shorter by default.

Out of scope:

- Shortening `estimates`, `ifConditionsMet` or `current` (they are the answer).
- Trimming the `notIncluded`, `restrictions` and `assumptions` text on each estimate. That text is part of what the user is told; if we want it shorter, it is its own change.
- Any change to what is estimated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-comparison`: the list of plans that could not be estimated is capped by default and can be extended on request.

## Impact

- `src/tools/compare-energy-plans.ts`: the input, the `notEstimated` slice and the description.
- `src/energy/compare/rank.ts`: the text view's cap and its "and N more" line.
- The inkview and structured output are unchanged apart from the shorter list.
- Tests for the tool and the text view.
