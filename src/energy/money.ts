/** Money is stored as integer hundred-thousandths of a dollar, so sums never drift. */
export const MONEY_SCALE = 100_000;

/** Parses a CDR decimal string such as "0.2345" or "1.1" into scaled integer units, or undefined. */
export function parseMoney(v: unknown): number | undefined {
  if (typeof v === "number") v = String(v);
  if (typeof v !== "string") return undefined;
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) return undefined;
  const frac = (m[3] ?? "").padEnd(5, "0");
  // More than 5 decimals: keep the integer scale and round the remainder.
  const base = Number(m[2]) * MONEY_SCALE + Number(frac.slice(0, 5));
  const rounded = frac.length > 5 && Number(frac[5]) >= 5 ? base + 1 : base;
  return m[1] ? -rounded : rounded;
}

export function formatMoney(units: number, decimals = 2): string {
  return (units / MONEY_SCALE).toFixed(decimals);
}
