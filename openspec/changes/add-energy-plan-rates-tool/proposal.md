# Proposal

## Why

Some questions need no usage at all, for example "how do these two plans differ?" or "line up Origin's and AGL's plans for my postcode". Today the only side-by-side answer is `compare_energy_plans`, which needs usage and returns ranked totals. A host that has no usage can only call `get_energy_plan` once per plan and line up the figures itself, which invites mistakes in the narration.

There is also a real case with no usage at all: a small business with no bill or readings. There's no benchmark for a business, so compare refuses, and the user gets nothing.

Iven (24 Nov 2026) asked for a head-to-head comparison with no usage, and left the choice of a new tool versus a mode open. A new tool keeps it apart, for three reasons:

- The inputs differ: plan ids, not usage.
- The questions the host asks differ: none about bills.
- The output differs: rates side by side, with no totals or ranking.

Folding it into compare as another `usageSource` would bring back the "which fields go together" problem the restructure change removes.

## What Changes

- **New tool `compare_energy_plan_rates`** (flat inputs):
  - required: `postcode` and `planIds` (2 to 5 ids from `search_energy_plans`, `list_current_plan_options` or a compare result);
  - optional: `currentPlanId`, which marks one of them as the user's current plan.
- **What it returns.** For each plan, in the order given:
  - retailer and plan name, fuel, plan type and customer type;
  - daily supply charge and every usage rate, GST inclusive, with each band's hours in plain words (the same wording as `list_current_plan_options`);
  - controlled load, solar feed-in, discounts with their conditions, fees, contract length and eligibility conditions;
  - the plan link, source link, licence and as-of date.
- **No totals and no ranking.** Without usage, any total would rest on an assumed usage and any order would mislead. The result says once that a cost comparison needs usage, and that `compare_energy_plans` gives one.
- **Same distributor and fuel.** Plans must share a distributor that covers the postcode, and a fuel (dual fuel counts for both). Otherwise the tool refuses and names the mismatch, because rates differ by network.
- **Drawn as a comparison** with the Inkview `show_comparison` component (2 to 5 options), with no recommendation field set.
- **Business with no usage.** The instructions and skill point the host to this tool when a business has no bill or readings, instead of stopping.

Data source: the same AER Consumer Data Right plan data (CDR rule 2.6) and sync as `energy-plans`. No new data.

Hosts affected: Claude, ChatGPT and Gemini. This adds one new read-only tool.

Out of scope:

- Any estimated cost, ranking or "cheapest" wording.
- More than 5 plans (use `search_energy_plans` to list more).
- Plans across distributors or fuels.

## Capabilities

### New Capabilities

- `energy-plan-rates`: side-by-side rates of 2 to 5 named plans, with no usage, totals or ranking.

### Modified Capabilities

None.

## Impact

- New: `src/tools/compare-energy-plan-rates.ts` (reusing the rate formatting in `get-energy-plan.ts` and `energy-common.ts`), tests, eval prompts, and a section in `docs/areas/energy-plans.md`.
- Changed: the tool registry for the energy vertical, server instructions and the energy skill (when to use it).
- Independent of the other three changes. It can ship first.
- No migration.
