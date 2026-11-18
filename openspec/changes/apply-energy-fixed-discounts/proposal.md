# Proposal

## Why

The estimator turns only percentage discounts into dollars. Fixed-amount discounts (`methodUType: fixedAmount`) and usage-threshold discounts (`percentOverThreshold`) are stored but listed as "not included", so a plan with a guaranteed fixed discount looks dearer than it is and can rank too low. The CDR schema gives a fixed discount's amount but not how often it applies, so it cannot simply be added.

## What Changes

- Survey the stored plans (the full load of 12,258 residential plans) for `fixedAmount` and `percentOverThreshold` discounts: how many, guaranteed or conditional, amounts, and what their descriptions say about frequency and GST.
- Apply a fixed-amount discount in the estimate only when its frequency is known from a published field or a description pattern listed in the docs (for example "per year", "each month", "one-off"): yearly and monthly amounts are scaled to a year; one-off amounts are not in the yearly cost.
- A fixed discount whose frequency is not known is shown beside the plan with its amount and the words "frequency not published", and is not in the ordering cost.
- Apply a `percentOverThreshold` discount only when the threshold's period is known by the same rule.
- Conditional fixed or threshold discounts join the "If you meet the conditions" table on the same terms.
- GST treatment of fixed amounts follows what the survey shows (expected: published including GST, like fees).

Hosts affected: none directly; Claude, ChatGPT and Gemini get changed figures in the same fields.

Data source: no new data. CDR product reference data (CDS 1.35.0), already loaded.

Out of scope: sign-up credits and incentives (`incentives`), which stay as left out; percentage discounts (unchanged); time-of-use matching.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `energy-plan-comparison`: fixed-amount and threshold discounts are applied when their frequency is known, and shown, not applied, when it is not. (Its requirements are still in the unarchived `add-energy-plan-tools` change, so this delta only adds requirements.)

## Impact

- `src/energy/normalise.ts` (keep threshold `usageAmount`; keep discount `endDate`), `src/energy/types.ts`, `src/energy/calc.ts`, `src/tools/compare-energy-plans.ts` (text for unknown-frequency discounts), tests, `docs/energy-estimates.md`.
- Stored plans need `renormalise-energy` once after deploy (normalised discount shape changes).
