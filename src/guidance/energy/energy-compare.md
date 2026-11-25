---
description: Use when someone wants the yearly cost of energy plans compared for their own usage (a bill, a yearly figure, readings or typical usage), including whether a plan costs less than the one they are on. Chooses the usage source and explains the result.
---

# Energy: compare costs

Say "lowest estimate for the usage you gave", never "best" or "recommended". Pass on the assumptions, the conditions on discounts and the notice that come with every result.

1. **Choose the usage source** (best evidence first) and always send `customerType` and `usageSource`:
   - `readings`: a profile from `summarise_interval_readings` as `readingsProfile` (see `energy-readings`).
   - `assistant_readings`: readings you summed yourself, with `usage`, `usageDays`, the split and the hours.
   - `bill`: `usage` and `usageDays` from a recent bill (kWh; gas: MJ). Never assume usage. Read it per `energy-current-plan`.
   - `yearly`: `usage` for a year.
   - `typical`: only if the user has no bill and agrees. Ask how many people live there (1 to 5, 5 meaning five or more) and send `householdSize`. Say it is typical usage for a household of that size in that zone (an AER benchmark), not the user's own, and that real cost can differ a lot. Time-of-use plans cannot be estimated this way, and solar and controlled load are left out.
   Send only the fields the source needs: a field from another source is refused with its name.
2. **Time-of-use and extras.** For time-of-use plans ask for the peak, shoulder and off-peak split on the bill (with `bill` or `yearly`), and the plan's hours from `energy-current-plan`. Ask about solar (export figure) and controlled load.
3. **Call `compare_energy_plans`.** Pass `distributor` if the postcode has several. Pass `currentPlanId` (the plan the user picked) to cost their current plan as a baseline.
4. **Answer.** Lead with the result's usage accuracy sentence. Plans with the same hours as the current plan are exact; others are in a separate table labelled approximate: say so. With a baseline, give the current plan's own estimate and each plan's difference, in the words "a lower (or higher) estimate than your current plan for the usage given": never "better", "save", "switch" or "recommended". If the baseline was not costed (for example a time-of-use plan under typical usage, or a plan no longer in the data), say why and give no difference.
5. **Conditions.** Show "If you meet the conditions" as a separate table with each plan's conditions. Say these costs apply only if the user meets every listed condition, and ask whether they expect to.
6. **Next steps.** Follow the result's `nextSteps`: a bill with no split offers the split or readings; a single electricity bill or typical usage carries a "More accurate comparison" note about interval readings: mention it once, in its words (the distributor link is only there if its page was checked). Never add a fee or a time of your own.
7. **Plans not estimated.** Say why in the tool's words, give the plan link and no cost. Do not work it out yourself.

See `references/worked-example.md` for the shape of a good answer.
