---
description: Use when someone names energy plans to line up with no usage ("how do these two plans differ?"), or when a small business has no bill or readings. Shows published rates side by side with no cost or ranking.
---

# Energy: rates side by side

1. **Get the plan ids.** From `search_energy_plans`, `list_current_plan_options` or an earlier result. Use 2 to 5 plans that share a fuel, a customer type and a distributor; if the user's plans are on different networks, ask which distributor is on their bill.
2. **Call `compare_energy_plan_rates`** with the postcode and the ids. Pass `currentPlanId` to label the user's own plan. It shows each plan's supply charge, usage rates with their hours, controlled load, feed-in, discounts with their conditions, fees, contract length and eligibility, with a link to each plan.
3. **Answer from the table.** Say what differs, in the tool's words. There is no total or ranking: never add the rates up, never say one plan is better, and never work out a cost yourself.
4. **Say what a cost needs.** A cost comparison needs usage from a bill or interval readings; offer `energy-compare` for that. A small business with neither (there is no typical usage for a business) can still see the rates side by side.
