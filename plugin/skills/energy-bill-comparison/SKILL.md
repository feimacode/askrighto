---
name: energy-bill-comparison
description: Use when someone wants to compare electricity or gas plans, check if they could pay less on their power bill, or compare retailers for an Australian address or postcode. Collects the bill details first, then compares plans using Ask Righto tools.
---

# Energy bill comparison

Compare plans on the user's real usage. Every figure comes from an Ask Righto tool result; follow the `ask-righto-grounding` skill for how to quote results. If the user gives different instructions, follow the user.

## Steps

0. **Home or business.** Ask whether the plans are for a home or a business (including small business) and do not assume. Pass `customerType` (`RESIDENTIAL` or `BUSINESS`) to every energy tool. A business is compared only with business plans and a household only with residential plans, and the result says which. Every plan in the data is for a residential or a small business customer, so `BUSINESS` means small business: large customers are not in the data and are not compared (their contracts are negotiated, not published plans), so if the user is a large customer, say so and stop. There is no typical usage for a business: it needs a bill or interval readings.
1. **Postcode.** Ask for the postcode (or suburb), then call `search_energy_plans`. Do not ask for a name, address or account number.
2. **Distributor.** If the postcode has more than one distributor, ask which one is on the bill. Costs differ by network.
3. **Usage from a bill.** Ask for the kWh used and the number of days on a recent bill (gas: MJ). Never assume usage. If the user has no bill, say so and offer a typical-usage estimate, or to wait until they have one. See `references/read-your-bill.md`.
   - **Typical usage (only if there is no bill, and the user agrees).** Ask how many people live in the household (1 to 5, 5 meaning five or more), then call `compare_energy_plans` with `useBenchmarkUsage` true and `householdSize`. The usage then comes from the AER's published benchmark for that postcode, not from you. Always say it is typical usage for a household of that size in that zone, not the user's own, and that real cost can differ a lot. Time-of-use plans cannot be estimated this way, and solar export and controlled load are left out. If the user can find a bill later, redo the comparison with it.
4. **Time-of-use.** If the user is on or considering time-of-use plans, ask for the peak, shoulder and off-peak split shown on the bill. Without it, those plans are listed as not estimated.
5. **Solar and controlled load.** Ask whether they have solar (and the feed-in or export figure on the bill) and a controlled-load circuit such as hot water.
6. **Compare.** Call `compare_energy_plans` with the answers.
7. **Answer.** Say "lowest estimate for the usage you gave" (for typical usage: "lowest estimate for typical usage, not your own"), never "best" or "recommended". Pass on the assumptions and the notice that come with the result. Give each plan's link.
8. **Conditional discounts.** Show the result's "If you meet the conditions" table as a separate table after the main one, with each plan's conditions. Say these costs apply only if the user meets every listed condition (for example paying on time or holding a membership), and ask whether they expect to.

## Interval readings

If the comparison used typical usage or a single bill, the result includes a "More accurate comparison" note: the household can ask its retailer or its electricity distributor for interval readings (use in half-hour steps), which also lets time-of-use plans be compared. Offer it once, in the result's words. If it links the distributor's request page, give that link; if not, do not guess one. Never add a fee or a time the note does not state. Ask Righto does not request the readings for the household. If the user has the file, use `summarise_interval_readings` (see the next section); do not ask them to send it anywhere else.

## If the user has their interval readings

If the user has downloaded interval readings (a NEM12 CSV, half-hourly kWh, from their distributor or retailer), call `summarise_interval_readings` with the file text unchanged and their postcode. It returns the period, days present and missing, totals and a profile. Pass that profile unchanged as `readingsProfile` to `compare_energy_plans`: time-of-use plans are then estimated from the household's own use. Do not add up or restate the half-hourly figures yourself, do not ask the user to send the file anywhere else (do not ask the user to send it to anyone), and say the file is read for the request only and not stored. Controlled load is not costed separately: say so. Accumulation (NEM13) files have no half-hourly figures; ask for interval data instead.

## Plans that are not estimated

If a plan comes back as not estimated, say why in the tool's words, give the plan link, and give no cost. Do not work it out yourself.

## If data is unavailable

Say energy data is temporarily unavailable. Do not quote prices from memory.

See `references/worked-example.md` for the shape of a good answer.
