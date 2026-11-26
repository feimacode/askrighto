## Context

`list_current_plan_options` groups plans with identical rates and hours into options. Each option has `optionId` (first 8 hex digits of a SHA-256 of the option's rates, layout and GST basis, `s.key` in the code), `planIds` (up to 3 ids, with `moreIds` for the rest) and `planNames`. `compare_energy_plans` takes `currentPlanId`, a stored plan id such as `RED809594MR@VEC`, and looks it up with `store.plan(id)`.

In the 30-run test, 29 runs passed the right plan id. One passed `optionId`. When the usage is a bill or a yearly figure, the comparison does not need the plan's hours, so `resolveHours` never looks the plan up. The only check is `resolveCurrent`, which returns `costed: false, reason: not_in_data`. That is a quiet result by design, because a household's plan can be retired and missing from the data.

## Goals / Non-Goals

**Goals:**
- A host cannot mistake any id in the pick list for the one `currentPlanId` wants.
- A wrong kind of id fails loudly, with the fix in the message.
- A real plan id for a plan that is no longer offered keeps today's quiet `not_in_data`.

**Non-Goals:**
- Accepting option ids, or any new lookup state.
- Changing grouping, ranking or the form shown to the user.

## Decisions

**1. Remove `optionId` and add `currentPlanId` to each option.** The new field has the same name as the parameter it feeds, so copying it across is the obvious thing to do. Nothing reads `optionId` today: it is used only to group options inside the tool and to print "(id …)" in the text, which becomes "Option N".
- Alternative: keep `optionId` and rename it (`optionRef`, `optionKey`). Rejected: a second id stays next to the real one, and a host can still pick it.
- Alternative: leave the fields and fix only the wording. Rejected: the test showed the wording was already there ("an id from the chosen option") and was not enough.

**2. The value of `currentPlanId` is `planIds[0]`.** It is the plan the invoice's code names when there is one (the list already sorts that plan first), otherwise the first by id. Any plan in the group has the same rates and hours, so the baseline is the same whichever is used.

**3. Refuse ids with no `@`, in `compare_energy_plans`, for every usage source.** Plan ids in the data all have the form `<code>@<distributor code>`. A hash, an option number or a plan name cannot match. The check goes in one place, before `resolveHours` and `resolveCurrent`, so bill, yearly, readings and typical usage all get it. The error is `needs_input`, as `resolveHours` already uses for an unknown id, and says: `currentPlanId must be the plan id from the option the user picked (the option's currentPlanId field, such as RED809594MR@VEC), not an option number or option id.`
- Alternative: map an option id back to a plan. Rejected: the key is a hash of the option's contents, so the server would have to rerun the whole list to find it, using the same retailer, network and invoice figures the compare call does not have. That adds hidden state between two tools that are meant to be independent.
- Alternative: refuse every id not in the data. Rejected: it contradicts the "plan not in the data" scenario in `add-energy-current-plan-baseline`, and a household whose plan was retired still wants the ranking.

**4. Say more in `not_in_data`.** Add one sentence: copy the id from the option the user picked, or leave `currentPlanId` out if the user's plan is no longer offered. The host reads it and can correct itself in the same turn.

## Risks / Trade-offs

- A client that read `optionId` breaks. We found no reader in the repo or the skills; the hosted connector is deployed from this repo, so the change ships with the new `compare_energy_plans` that does not need it.
- The `@` rule assumes plan ids keep their form. They come from the AER's CDR data, where a `planId` has the retailer's code and `@` plus a distributor code. If a retailer used another form, the refusal would block a real id. The check would be wrong on the safe side: the message tells the host to copy the id from the list, and the list shows every id as stored.
