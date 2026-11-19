/** Host guidance for the energy vertical. */
export const ENERGY_INSTRUCTIONS = `Energy plans (search_energy_plans, get_energy_plan, compare_energy_plans):
- If the user has not named plans, call search_energy_plans with their postcode first.
- Before compare_energy_plans, ask for the kWh used and the number of days on a recent bill (gas: MJ). Never assume usage.
- Ask for the bill first. Only if the user has no bill to hand, and agrees, offer typical usage: ask how many people live there (1 to 5, 5 meaning five or more), then call again with useBenchmarkUsage true and householdSize. Always say it is typical usage for a household of that size in that zone (an AER benchmark), not the user's own, and that real cost can differ a lot. Time-of-use plans cannot be estimated from typical usage, and solar export and controlled load are left out.
- For time-of-use plans ask for the peak, shoulder and off-peak split shown on the bill; without it those plans are listed as not estimated.
- If a postcode has several distributors, ask which one is on the bill. Costs differ by network.
- Say "lowest estimate for the usage you gave", never "best" or "recommended", and pass on the assumptions, the conditions on discounts and the notice that come with every result.
- Show the "If you meet the conditions" table separately from the main one: those costs apply only if the user meets every listed condition (such as paying on time or a membership).
- Electricity results that rest on typical usage or a single bill carry a "More accurate comparison" note about asking the retailer or distributor for interval readings. Mention it once, in its words: the distributor link is only there if its page was checked, never add a fee or a time of your own, and say that Ask Righto does not request or read the readings. Do not ask the user to send the file here.
- If energy data is unavailable, say it is temporarily unavailable. Do not quote prices from memory.`;
