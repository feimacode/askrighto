# Design

## Context

`calc.ts` applies `percentOfBill` and `percentOfUse` discounts and pushes every other method to `notIncluded`. `normalise.ts` keeps `amount` for `fixedAmount` and `percent` for the percentage methods, but drops `percentOverThreshold.usageAmount` and the discount's `endDate`. The schema (CDS 1.35.0 `EnergyPlanDiscounts`) has no frequency field for any discount. Fees are published including GST (AGL, see `docs/cdr-schemas.md`); the schema is silent on fixed discounts.

## Goals / Non-Goals

**Goals:**
- No cost changes from a guess: a fixed amount moves a cost only when its frequency is stated.
- Make the rule auditable: the patterns that set a frequency are a short list in the docs and code, with tests.

**Non-Goals:**
- Reading free text for anything other than frequency and threshold period.

## Decisions

**Survey before rules.** Task 1 runs a read-only query over the stored raw payloads (WSL load on FengsPC, or the VM after the production load) and writes counts, typical amounts, and the most common description phrasings for `fixedAmount` and `percentOverThreshold` to `docs/energy-estimates.md`. The frequency patterns are then fixed from what retailers actually write. If the survey shows almost no stated frequencies, the change ships only the "shown, not applied" behaviour and the end-date handling, and says so.

**Frequency from a closed list of description patterns.** A discount's frequency is `YEARLY`, `MONTHLY`, `ONE_OFF` or `UNKNOWN`, decided by case-insensitive patterns such as `per year|annual|each year`, `per month|monthly|each month`, `one-off|once|first bill|sign-up`. Ambiguous text (matches more than one, or "per bill" whose bill period is unknown) is `UNKNOWN`. Alternative: assume yearly for all; rejected as a guess that moves rankings. Alternative: never apply fixed discounts; rejected because guaranteed yearly credits are real and common enough to matter (to be confirmed by the survey).

**GST.** Fixed amounts are treated like fees, as published and outside the GST line, unless the survey finds descriptions saying they exclude GST; then the rule follows the survey and `docs/cdr-schemas.md` is updated.

**Threshold discounts.** `percentOverThreshold` keeps `usageAmount`; the discount applies to usage above the threshold only when the threshold's period is known by the same patterns. The usage above the threshold is worked out from the yearly usage scaled to that period.

**End dates.** Normalise keeps `endDate`. A discount past its end date is dropped from the estimate; one ending within 12 months is applied for the full year and noted (the estimate is for the plan as published today).

**Normalised shape change.** New fields on `Discount`: `frequency`, `usageAmount`, `endDate`. Stored plans pick them up with `renormalise-energy` (no API calls).

## Risks / Trade-offs

- [Pattern misreads a description] → patterns are few, tested on the survey's real phrasings, and UNKNOWN is the default.
- [Ranking changes after deploy] → expected; the PR states the count of plans whose estimate moves, from a dry-run over the survey data.
- [Applying a discount for the full year when it ends in months] → the plan notes the end date; a pro-rata rule can follow if users need it.

## Migration Plan

Deploy, then run `node dist/askrighto.js renormalise-energy` once and restart. Rollback: redeploy the previous image and re-run `renormalise-energy`.
