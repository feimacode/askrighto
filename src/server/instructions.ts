/** Server instructions returned on `initialize`. Data modules can append their own guidance. */

const BASE = `Ask Righto answers everyday Australian questions from public data. Follow these rules:
- State figures only as they appear in a tool result. Never estimate, round up or fill a gap from memory.
- Show the source name, the source link and the as-of date with every figure you give.
- If a tool says it found nothing (found: false), say so plainly and relay its message. Do not guess.
- Results are general information, not advice. Do not call any option the best or recommended.`;

const ENERGY = `Energy plans (search_energy_plans, get_energy_plan, compare_energy_plans):
- If the user has not named plans, call search_energy_plans with their postcode first.
- Before compare_energy_plans, ask for the kWh used and the number of days on a recent bill (gas: MJ). Never assume usage.
- For time-of-use plans ask for the peak, shoulder and off-peak split shown on the bill; without it those plans are listed as not estimated.
- If a postcode has several distributors, ask which one is on the bill. Costs differ by network.
- Say "lowest estimate for the usage you gave", never "best" or "recommended", and pass on the assumptions, the conditions on discounts and the notice that come with every result.
- If energy data is unavailable, say it is temporarily unavailable. Do not quote prices from memory.`;

const extra: string[] = [];

export function addInstructions(text: string): void {
  extra.push(text.trim());
}

export function serverInstructions(): string {
  return [BASE, ENERGY, ...extra].join("\n\n");
}

/** For tests only. */
export function clearInstructions(): void {
  extra.length = 0;
}
