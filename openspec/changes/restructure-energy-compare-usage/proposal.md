# Proposal

## Why

`compare_energy_plans` grew one input at a time and now takes 23 flat optional fields. Four different jobs share them: a single bill total, a bill with a peak, shoulder and off-peak split, typical household usage, and interval readings. The schema can't say which fields belong together, so a wrong mix is either dropped silently or rejected with a misleading message. These cases were found in the review of 23 Nov 2026 and confirmed in `src/tools/compare-energy-plans.ts`:

- Gas given `annualUsageKwh` returns "No usage was given". The field exists, but it is read only for electricity.
- `currentPlanId` and `hoursLayoutId` are ignored unless a split is also sent, and nothing says so.
- `useBenchmarkUsage` is ignored when any usage is given. Its partner `householdSize` is a second field.
- `customerType` defaults to RESIDENTIAL, while the instructions say never to assume it.
- Rules live only in the handler: `billDays` is needed with a bill, the split must add up to 100, and typical usage rules out a split, controlled load and solar.

Iven (24 Nov 2026) framed the jobs as one ladder of usage evidence, best first:

1. full interval readings, summarised by our server;
2. readings the assistant summed itself by the NEM12 recipe (the fallback when a file is too big to send);
3. a bill with the band split;
4. a bill with one total;
5. typical usage for the household size (AER benchmark).

Every level ends in the same result, a yearly cost per plan ranked from lowest. Only the usage evidence changes. So the input should name its level once, and the result should state that level up front. Level 2 has no name of its own today. It is sent as a bill split plus `currentPlanId`, so the result can't say it came from readings the assistant summed.

## What Changes

- **BREAKING:** the usage fields of `compare_energy_plans` are replaced by a required `usageSource` (`readings`, `assistant_readings`, `bill`, `yearly`, `typical`) plus the fields that source needs:
  - `readings`: `readingsProfile`.
  - `assistant_readings`: `usage`, `usageDays` and the band split, with `currentPlanId` or `hoursLayoutId` (the hours the readings were banded by).
  - `bill`: `usage` and `usageDays`, with an optional band split.
  - `yearly`: `usage`.
  - `typical`: `householdSize`.
- One `usage` field replaces `annualUsageKwh`, `billUsageKwh`, `annualUsageMj` and `billUsageMj`. Its unit follows `fuelType` (kWh for electricity, MJ for gas), which ends the gas-given-kWh case.
- `useBenchmarkUsage` is removed: `usageSource: typical` replaces it.
- `customerType` becomes required.
- Any field that doesn't belong to the chosen source is refused with a plain message naming the field and the source. It is never dropped silently. A `currentPlanId` given with a bill but no split gets a warning in the result rather than a refusal, because the next change uses it for the baseline.
- The result carries `usage.level` (the source) and a one-line `usage.accuracy` statement shown before the figures, the same way the typical-usage and readings notices are shown today. The `assistant_readings` level is labelled "own readings, summed by the assistant, not verified by Ask Righto".
- Internal: the ~330-line handler is split into `resolveUsage` (pure, unit-tested), `selectPlans` (store, distributor, retailer, plan type, plan ids) and `rank` (estimates, exact and approximate tables, conditions table, rendering). The ranking, its tables and the cost model don't change.

Data source: unchanged. The tool reads the same AER Consumer Data Right plan data (CDR rule 2.6), refreshed by the existing sync, and the AER benchmarks (CC BY 4.0). No new data.

Hosts affected: Claude, ChatGPT and Gemini all see the new input. The schema stays flat, with `usageSource` as a plain enum and no `oneOf`. This follows the project rule of flat input schemas, and suits ChatGPT strict mode and Gemini.

Out of scope:

- Costing the current plan and showing differences from it (`add-energy-current-plan-baseline`).
- A rates-only comparison with no usage (`add-energy-plan-rates-tool`).
- Rewriting descriptions, server instructions and skills beyond the field renames (`split-energy-host-guidance`).
- Changes to the cost model, discounts, concessions or the readings summary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-comparison`: the usage input names its source, fields are checked against that source, and the result states the usage level.

## Impact

- Changed: `src/tools/compare-energy-plans.ts`, split into `src/energy/compare/resolve-usage.ts`, `select-plans.ts` and `rank.ts`. Also `src/energy/instructions.ts` (field names), `plugin/skills/energy-bill-comparison/` (field names), and the 8 test files that call compare.
- Docs: `docs/energy-estimates.md`, `docs/energy-invoice.md`, `docs/energy-readings-recipe.md`, `docs/energy-benchmarks.md`, `docs/areas/energy-plans.md`, `docs/energy-evaluation/prompts.md` (the `arg:` checks).
- Breaking for any host session that cached the old schema. The energy tools are on the public route but not yet listed in any directory, so we switch outright rather than keep both shapes.
- No migration.
