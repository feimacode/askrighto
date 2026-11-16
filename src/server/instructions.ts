/** Server instructions returned on `initialize`: the base rules plus each served vertical's guidance. */
import { ENERGY_INSTRUCTIONS } from "../energy/instructions.js";
import { baseInstructions } from "../guidance/shared.js";

const extra: string[] = [];

export function addInstructions(text: string): void {
  extra.push(text.trim());
}

export function serverInstructions(
  verticalTexts: readonly string[] = [ENERGY_INSTRUCTIONS],
): string {
  return [baseInstructions(), ...verticalTexts, ...extra].join("\n\n");
}

/** For tests only. */
export function clearInstructions(): void {
  extra.length = 0;
}
