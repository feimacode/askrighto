## Context

The handler today (`src/tools/compare-energy-plans.ts`, 530 lines, one handler of about 330) works out usage from whichever fields happen to be present, in this order: readings, then annual, then bill scaled by days, then benchmark. Fields that don't fit the path it took are dropped. Readings are the one exception, where the dropped fields are listed in `ignored`. The 25-prompt energy eval set (`docs/energy-evaluation/prompts.md`) has no recorded host runs in the repo, so we don't yet have a count of how often hosts send a wrong mix. Task 1.1 measures it before and after.

## Goals / Non-Goals

**Goals:** one place decides the usage level. Every field is either used or refused with a reason. The level is visible in the result. The handler parts can be tested without a store.

**Non-goals:** new cost logic, a current-plan baseline, a rates-only mode, or shorter descriptions.

## Decisions

1. **Flat schema with a discriminator, not a nested object.** `openspec/config.yaml` requires flat input schemas, and `oneOf` behaves badly in ChatGPT strict mode and in Gemini. So `usageSource` is a required enum, and the per-source fields stay top level. Each field's description starts with the sources it belongs to (for example "bill, assistant_readings: ..."). We considered a nested `usage` object with its own `source`. It reads better, but it breaks the flat-schema rule for no gain in what hosts can check.

2. **Sources and their fields.**

   | usageSource | needs | may add | refused |
   |---|---|---|---|
   | `readings` | `readingsProfile` | `controlledLoadAnnualKwh` | `usage`, `usageDays`, split, `householdSize`, `solarExportAnnualKwh` (the profile carries export) |
   | `assistant_readings` | `usage`, `usageDays`, split, `currentPlanId` or `hoursLayoutId` | `controlledLoadAnnualKwh`, `solarExportAnnualKwh` | `readingsProfile`, `householdSize` |
   | `bill` | `usage`, `usageDays` | split, `currentPlanId` or `hoursLayoutId`, `controlledLoadAnnualKwh`, `solarExportAnnualKwh` | `readingsProfile`, `householdSize` |
   | `yearly` | `usage` | same as `bill` except `usageDays` | `readingsProfile`, `householdSize`, `usageDays` |
   | `typical` | `householdSize` | none | everything else in this table |

   Electricity only: `readings`, `assistant_readings`, the split, controlled load and solar. Gas with any of these is refused with a message naming the field. `typical` with `customerType: BUSINESS` is refused (there's no business benchmark), as today.

3. **`assistant_readings` is its own level.** The fallback recipe (`docs/energy-readings-recipe.md`) bands readings by the current plan's hours, so the hours are required, not optional. `usageDays` is the number of days the readings cover. The result is labelled "own readings, summed by the assistant, not verified by Ask Righto". This reuses the wording of `UNVERIFIED_READINGS`. Plans with the same hours are exact, and the others are approximate, as with a bill split.

4. **Refuse, don't drop.** A field outside its source returns `needs_input`: "`<field>` is not used with usageSource `<source>`. Call again without it, or with the source it belongs to." One case is a warning instead: `currentPlanId` with `bill` or `yearly` and no split. The id is kept for the baseline in the next change, and the result's `warnings` says the hours weren't needed.

5. **Split sum.** The split is checked against 100 within 0.5 points, as today. A missing band counts as 0 only when the others still add up to 100.

6. **Result shape.** `usage` gains `level` (the source) and `accuracy` (one sentence, for example "Your own bill for 92 days, scaled to a year; time-of-use plans with different hours are approximate."). The text output leads with `accuracy`, as `typicalUsageNotice` and `readingsNotice` lead today. Those two notices stay, so docs and evals that quote them still hold. A new `warnings: string[]` holds non-fatal notes.

7. **Code split.**
   - `resolveUsage(args) -> { ok: true, usage: ResolvedUsage, warnings } | { ok: false, reason, message }` is pure. It holds the table above, the unit, the scaling and the split check. It does not do the benchmark lookup, which needs the store.
   - `selectPlans(store, args)` covers the postcode, customer type, fuel, distributor, retailer, plan type and plan ids.
   - `rank(plans, usage, hoursBasis)` produces the estimates, the exact, approximate and conditions tables, the not-estimated list, and the rendering.

   The tool handler wires the three together.

8. **Source and date.** Unchanged: every result carries the `energy-plans` source link, licence and as-of date, plus the AER benchmark attribution and release for `typical`. A refusal carries no figures.

## Risks / Trade-offs

- A breaking rename can confuse a host session that cached the old schema. That risk is small while nothing is listed. The server instructions and skill change in the same PR.
- More refusals could mean more round trips. Each refusal names the exact fix, and task 1.1 measures whether host mistakes go down.
- Hosts may still pick the wrong source. The descriptions name the order of preference, and the skill and result messages steer.

## Open Questions

- Should `yearly` stay, or fold into `bill` with `usageDays: 365`? It's kept because some users know only a yearly figure.
