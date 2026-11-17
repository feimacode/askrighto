## Why

The home loan tools return published facts and arithmetic. The wording around them carries most of the regulatory risk: an assistant that says "this is the best loan for you" or "you'd be approved" turns information into credit assistance. A skill can hold the intake, the quoting rules and the refusals in a form that Claude and ChatGPT load, and that the answer-review skill can check against.

## What Changes

- Add `home-loan-comparison` skill under `plugin-internal/skills/` (unlisted until promotion, like the course skills): what to ask (purpose, repayment type, fixed or variable, approximate LVR, features wanted), which tool to call, how to quote.
- Required wording rules: say "published rate" and "lowest published rate for the filters you gave", never "best", "cheapest overall", "recommended" or "you should"; give the lender's link for every product; pass on the notices in the tool result without softening; state which lenders the list covers.
- Refusal and redirect rules: no suitability advice, no approval or borrowing capacity, no "should I refinance or switch", no application help, no interpretation of the user's finances. Point to the lender, a licensed broker or the ASIC MoneySmart pages for those, and say Ask Righto does not give them.
- Calculator rules: the host must pass the user's own numbers unchanged, say the result is arithmetic on the rate shown, list the "not modelled" items, and never mix its own mental arithmetic with the tool's figures.
- Privacy rules: do not ask for income, employer, name, address or credit history; if the user volunteers them, do not repeat or use them.
- Under-18 and minors rule: keep to general information and suggest talking to a parent or guardian before any decision (ChatGPT allows 13 to 17 year olds).
- Add reference files: `references/read-published-rates.md` (what a published rate, tier, comparison rate and tailored product mean, in plain words) and `references/worked-example.md`.
- Extend `docs/skills/activation-prompts.md` with positive and negative activation prompts for the new skill.
- Extend the maintainer `ask-righto-answer-review` skill's banned-wording list for credit terms.

## Capabilities

### New Capabilities

- `home-loan-skills`: workflows and guardrails for home loan comparison answers.

### Modified Capabilities

None.

## Impact

- New files under `plugin-internal/skills/home-loan-comparison/`, `docs/skills/`; small edit to the answer-review skill's banned list; marketplace entry keeps the skill unlisted.
- Shared rules stay in `src/guidance/shared.ts`; credit-specific rules go in a new `src/homeloans/guidance.ts`, with a CI check that the skill reference matches it (same pattern as `guidance:check`).
- Depends on `add-home-loan-tools` and `add-host-guidance`. Hosts: Claude and ChatGPT (skills); Gemini follows the server instructions only.

Out of scope: a custom agent; a broker-style intake; any advice flow; skills for deposits or other banking products.
