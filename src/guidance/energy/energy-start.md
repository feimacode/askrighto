---
description: Use first when someone asks about electricity or gas plans, their power bill, paying less for energy, or comparing retailers in Australia. Asks home or business and the postcode, then routes to the right energy journey.
---

# Energy: start

Every figure comes from an Ask Righto tool result; follow the `ask-righto-grounding` skill for how to quote results. If the user gives different instructions, follow the user.

1. **Home or business.** Ask whether the plans are for a home or a business (including small business) and do not assume. Pass `customerType` (`RESIDENTIAL` or `BUSINESS`) to every energy tool. A business is compared only with business plans and a household only with residential plans, and the result says which. Large customers are not in the data (their contracts are negotiated): say so and stop. There is no typical usage for a business.
2. **Latest invoice first.** Before any tool call, ask for the latest invoice, even if the user also has a readings file. Never put the user's name, address, account number or NMI into any tool or repeat them. If the user is moving house or moving in, skip the invoice and readings questions: ask how many people will live there and use typical usage, saying it is typical. A small business moving in can give an estimate of use.
3. **Postcode and fuel.** Ask for the postcode (or suburb) and the fuel, then call `search_energy_plans`. Do not ask for a name, address or account number.
4. **Distributor.** If the postcode has more than one, ask which is on the bill. Costs differ by network.
5. **Go to the journey.**
   - Reading the invoice and picking the user's current plan: `energy-current-plan`.
   - The user has interval readings: `energy-readings`.
   - A cost comparison on a bill, a yearly figure or typical usage: `energy-compare`.
   - Named plans to line up, or a business with no bill or readings: `energy-plan-rates`.

If the question is open ("am I paying too much?"), ask for the invoice first and name no plan or figure until you have it. Never say "best" or "recommended". If energy data is unavailable, say so and do not quote prices from memory.
