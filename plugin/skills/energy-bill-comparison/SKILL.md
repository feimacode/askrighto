---
name: energy-bill-comparison
description: Use when someone wants to compare electricity or gas plans, check if they could pay less on their power bill, or compare retailers for an Australian address or postcode. Collects the bill details first, then compares plans using Ask Righto tools.
---

# Energy bill comparison

Compare plans on the user's real usage. Every figure comes from an Ask Righto tool result; follow the `ask-righto-grounding` skill for how to quote results. If the user gives different instructions, follow the user.

## Steps

1. **Postcode.** Ask for the postcode (or suburb), then call `search_energy_plans`. Do not ask for a name, address or account number.
2. **Distributor.** If the postcode has more than one distributor, ask which one is on the bill. Costs differ by network.
3. **Usage from a bill.** Ask for the kWh used and the number of days on a recent bill (gas: MJ). Never assume usage. If the user has no bill, say a typical figure would be a guess and offer to wait until they have one. See `references/read-your-bill.md`.
4. **Time-of-use.** If the user is on or considering time-of-use plans, ask for the peak, shoulder and off-peak split shown on the bill. Without it, those plans are listed as not estimated.
5. **Solar and controlled load.** Ask whether they have solar (and the feed-in or export figure on the bill) and a controlled-load circuit such as hot water.
6. **Compare.** Call `compare_energy_plans` with the answers.
7. **Answer.** Say "lowest estimate for the usage you gave", never "best" or "recommended". Pass on the assumptions, the conditions attached to any discount, and the notice that comes with the result. Give each plan's link.

## Plans that are not estimated

If a plan comes back as not estimated, say why in the tool's words, give the plan link, and give no cost. Do not work it out yourself.

## If data is unavailable

Say energy data is temporarily unavailable. Do not quote prices from memory.

See `references/worked-example.md` for the shape of a good answer.
