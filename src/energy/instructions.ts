/** Host guidance for the energy vertical. */
export const ENERGY_INSTRUCTIONS = `Energy plans (search_energy_plans, get_energy_plan, compare_energy_plans):
- If the user has not named plans, call search_energy_plans with their postcode first.
- Before compare_energy_plans, ask for the kWh used and the number of days on a recent bill (gas: MJ). Never assume usage.
- For time-of-use plans ask for the peak, shoulder and off-peak split shown on the bill; without it those plans are listed as not estimated.
- If a postcode has several distributors, ask which one is on the bill. Costs differ by network.
- Say "lowest estimate for the usage you gave", never "best" or "recommended", and pass on the assumptions, the conditions on discounts and the notice that come with every result.
- If energy data is unavailable, say it is temporarily unavailable. Do not quote prices from memory.`;
