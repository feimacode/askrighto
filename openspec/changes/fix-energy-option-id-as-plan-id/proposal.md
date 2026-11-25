# Proposal

## Why

A drift test on 25 Nov 2026 ran the same four-step energy scenario 30 times (10 each on three Claude models) against the code on `main`. In 1 run a model passed the pick list's `optionId` (`9affe595`) as `compare_energy_plans` `currentPlanId`. The id is not a plan, so the current plan was not costed (`costed: false, reason: not_in_data`) and no plan showed a difference from it. Nothing was said to the user, and the model carried on, twice.

The cause is in our own result. Each option from `list_current_plan_options` carries two ids side by side, `optionId` (an 8-character hash of the option's rates, used for nothing else) and `planIds` (the real plan ids), and the tool text says "an id from the chosen option". Nothing says which one `currentPlanId` wants. A host that reads the first field it sees gets it wrong.

## What Changes

- **One id per option, named for what it is used for.** Each option gains `currentPlanId`: the plan id to pass on, ready to copy. `optionId` is removed from the result. The option is identified to the user by its number ("Option 1"), as the form already does. `planIds` stays, for the user-facing plan names and the extra plans in the group.
- **Plain descriptions.** The text of `list_current_plan_options` and `compare_energy_plans`, and the `nextStep` line, say to pass the chosen option's `currentPlanId` unchanged and never an option number or any other id.
- **A value that cannot be a plan id is refused, not skipped.** When `currentPlanId` is not shaped like a plan id (it has no `@`), `compare_energy_plans` returns `needs_input` that says so and names the option's `currentPlanId` field, for every usage source. A well-formed id for a plan that is no longer in the data still gives `current: not_in_data`, as `add-energy-current-plan-baseline` specifies.
- **`not_in_data` says more.** Its detail adds that the id must be copied from the option the user picked, or omitted if the user's plan is no longer offered.

Data source: unchanged. No new data and no change to any figure.

Hosts affected: Claude, ChatGPT and Gemini. The option's shape changes (one field removed, one added), so a host or client that read `optionId` stops getting it. Nothing in the repo reads it.

Out of scope:

- Accepting an option id as a plan id (decided against; see the design).
- Choosing the plan for the user. The user still picks.
- Any change to how the options are grouped or ranked.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-current-plan-match`: the pick list gives each option one id to pass on, and no other id field.
- `energy-plan-comparison`: a `currentPlanId` that is not a plan id is refused with a message that says what to pass.

## Impact

- `src/tools/list-current-plan-options.ts`: the `PlanOption` shape, the result text, the `nextStep` line and the tool description.
- `src/tools/compare-energy-plans.ts` and `src/energy/compare/current.ts`, `select-plans.ts`: the description, the shape check and the `not_in_data` detail.
- `src/guidance/energy/*.md` and the generated skills in `plugin/skills/`, only where they name the id.
- Tests for both tools.
