---
name: energy-bill-comparison
description: Use when someone wants to compare electricity or gas plans, check if they could pay less on their power bill, or compare retailers for an Australian address or postcode. Collects the bill details first, then compares plans using Ask Righto tools.
---

# Energy bill comparison

Compare plans on the user's real usage. Every figure comes from an Ask Righto tool result; follow the `ask-righto-grounding` skill for how to quote results. If the user gives different instructions, follow the user.

## Steps

0. **Home or business.** Ask whether the plans are for a home or a business (including small business) and do not assume. Pass `customerType` (`RESIDENTIAL` or `BUSINESS`) to every energy tool. A business is compared only with business plans and a household only with residential plans, and the result says which. Every plan in the data is for a residential or a small business customer, so `BUSINESS` means small business: large customers are not in the data and are not compared (their contracts are negotiated, not published plans), so if the user is a large customer, say so and stop. There is no typical usage for a business: it needs a bill or interval readings.
0a. **Latest invoice first.** Before any tool call, ask for the latest invoice, even if the user also has a readings file. Read from it, and show back for the user to confirm: the retailer and plan name, the usage and the days it covers, the usage in each peak, shoulder and off-peak band, the rates and daily supply charge (invoice rates include GST), any solar export, and the distributor. Pass tools only those figures plus retailer, distributor and postcode: never the user's name, address, account number or NMI, and do not repeat them. If the user is moving house or moving in, skip the invoice and readings questions, ask how many people will live there and use typical usage (say it is typical); for a small business moving in, ask for an estimate of use.
1. **Postcode.** Ask for the postcode (or suburb), then call `search_energy_plans`. Do not ask for a name, address or account number.
2. **Distributor.** If the postcode has more than one distributor, ask which one is on the bill. Costs differ by network.
3. **Usage from a bill.** Ask for the kWh used and the number of days on a recent bill (gas: MJ). Never assume usage. If the user has no bill, say so and offer a typical-usage estimate, or to wait until they have one. See `references/read-your-bill.md`.
   - **Typical usage (only if there is no bill, and the user agrees).** Ask how many people live in the household (1 to 5, 5 meaning five or more), then call `compare_energy_plans` with `useBenchmarkUsage` true and `householdSize`. The usage then comes from the AER's published benchmark for that postcode, not from you. Always say it is typical usage for a household of that size in that zone, not the user's own, and that real cost can differ a lot. Time-of-use plans cannot be estimated this way, and solar export and controlled load are left out. If the user can find a bill later, redo the comparison with it.
4. **Time-of-use.** If the user is on or considering time-of-use plans, ask for the peak, shoulder and off-peak split shown on the bill. Without it, those plans are listed as not estimated.
5. **Solar and controlled load.** Ask whether they have solar (and the feed-in or export figure on the bill) and a controlled-load circuit such as hot water.
5a. **Current plan's hours.** A bill split only means something against the hours of the plan the bill came from. Call `list_current_plan_options` with the retailer, distributor, customer type and the rates printed on the invoice. Show the options in plain words and let the user pick their plan, or "none of these" (then show the band hours it returns and let them pick or state the hours). Never choose for them and never match by plan name. Pass the picked option's plan id as `currentPlanId` (or the layout id as `hoursLayoutId`) to `compare_energy_plans`. Time-of-use plans whose hours differ are shown apart, labelled approximate: say so. With readings no hours question is needed.
6. **Compare.** Call `compare_energy_plans` with the answers.
7. **Answer.** Say "lowest estimate for the usage you gave" (for typical usage: "lowest estimate for typical usage, not your own"), never "best" or "recommended". Pass on the assumptions and the notice that come with the result. Give each plan's link.
8. **Conditional discounts.** Show the result's "If you meet the conditions" table as a separate table after the main one, with each plan's conditions. Say these costs apply only if the user meets every listed condition (for example paying on time or holding a membership), and ask whether they expect to.

## Interval readings

If the comparison used typical usage or a single bill, the result includes a "More accurate comparison" note: the household can ask its retailer or its electricity distributor for interval readings (use in half-hour steps), which also lets time-of-use plans be compared. Offer it once, in the result's words. If it links the distributor's request page, give that link; if not, do not guess one. Never add a fee or a time the note does not state. Ask Righto does not request the readings for the household. If the user has the file, use `summarise_interval_readings` (see the next section); do not ask them to send it anywhere else.

## If the user has their interval readings

Follow this ladder, and never add up the half-hourly figures yourself and apply peak or off-peak hours of your own: `compare_energy_plans` matches each plan's own windows, which one set of hours cannot.

1. **A file up to about 30 KB** (roughly 90 days of half-hourly data): call `summarise_interval_readings` with the file text unchanged and their postcode, then pass the profile it returns unchanged as `readingsProfile` to `compare_energy_plans`.
2. **A longer file, up to 250,000 characters:** the same call works, but writing it out takes a while, so tell the user.
3. **If you cannot pass the file text, or it is longer than that:** build the profile yourself as the `summarise_interval_readings` description sets out and pass it as `readingsProfile`. The result says it was built by the assistant and is not verified by Ask Righto; pass that on.
4. **If you cannot do that either:** ask for a shorter period or 30-minute intervals, or use the bill.

Say the file is read for the request only and not stored, and do not ask the user to send it anywhere else. Controlled load is not costed separately: say so. Accumulation (NEM13) files have no half-hourly figures; ask for interval data instead.

## Plans that are not estimated

If a plan comes back as not estimated, say why in the tool's words, give the plan link, and give no cost. Do not work it out yourself.

## If data is unavailable

Say energy data is temporarily unavailable. Do not quote prices from memory.

See `references/worked-example.md` for the shape of a good answer.
