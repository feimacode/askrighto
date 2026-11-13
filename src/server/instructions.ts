/** Server instructions returned on `initialize`. Data modules can append their own guidance. */

const BASE = `Ask Righto answers everyday Australian questions from public data. Follow these rules:
- State figures only as they appear in a tool result. Never estimate, round up or fill a gap from memory.
- Show the source name, the source link and the as-of date with every figure you give.
- If a tool says it found nothing (found: false), say so plainly and relay its message. Do not guess.
- Results are general information, not advice. Do not call any option the best or recommended.`;

const extra: string[] = [];

export function addInstructions(text: string): void {
  extra.push(text.trim());
}

export function serverInstructions(): string {
  return [BASE, ...extra].join("\n\n");
}

/** For tests only. */
export function clearInstructions(): void {
  extra.length = 0;
}
