/**
 * Repayment arithmetic in integer cents. Pure and deterministic: the same inputs always give the same
 * output, and nothing here reads a rate from anywhere. The caller supplies the rate and says where it
 * came from. Model (shown to users): nominal annual rate divided by payments a year, interest charged
 * each period on the balance less any offset, standard amortisation, last payment trimmed.
 * Not modelled: rate changes, fees, redraw, offsets not held for the whole period, day counts.
 */
export type Frequency = "monthly" | "fortnightly" | "weekly";
export const PERIODS_PER_YEAR: Record<Frequency, number> = { monthly: 12, fortnightly: 26, weekly: 52 };

export interface CalcInput {
  principalCents: number;
  termYears: number;
  annualRatePct: number;
  frequency: Frequency;
  repayment: "PRINCIPAL_AND_INTEREST" | "INTEREST_ONLY";
  extraPerPeriodCents?: number;
  /** Average offset balance held against this loan. */
  offsetCents?: number;
  /** Stop after this many months and report the balance (a fixed rate shorter than the term). */
  windowMonths?: number;
}

export interface CalcResult {
  periodsPerYear: number;
  scheduledPaymentCents: number;
  /** Periods actually run (until the loan is repaid, or the window or term ends). */
  periodsRun: number;
  totalInterestCents: number;
  totalPaidCents: number;
  /** Balance left when the run ended. Zero when repaid; the bullet amount for interest-only. */
  endBalanceCents: number;
  repaidEarly: boolean;
  /** Only when extra repayments or an offset were given: interest versus the same loan without them. */
  interestSavedCents?: number;
  periodsSaved?: number;
}

const MAX_PRINCIPAL_CENTS = 10_000_000_000; // $100m
export function validateInput(i: CalcInput): string | undefined {
  if (!Number.isInteger(i.principalCents) || i.principalCents < 100_000 || i.principalCents > MAX_PRINCIPAL_CENTS)
    return "The loan amount must be between $1,000 and $100,000,000.";
  if (!Number.isFinite(i.termYears) || i.termYears < 1 || i.termYears > 40) return "The loan term must be between 1 and 40 years.";
  if (!Number.isFinite(i.annualRatePct) || i.annualRatePct < 0 || i.annualRatePct > 30) return "The rate must be between 0% and 30%.";
  if ((i.extraPerPeriodCents ?? 0) < 0 || (i.offsetCents ?? 0) < 0) return "Extra repayments and the offset balance cannot be negative.";
  return undefined;
}

function scheduledPayment(i: CalcInput, r: number, n: number): number {
  if (i.repayment === "INTEREST_ONLY") return Math.round(i.principalCents * r);
  if (r === 0) return Math.round(i.principalCents / n);
  return Math.round((i.principalCents * r) / (1 - Math.pow(1 + r, -n)));
}

function run(i: CalcInput, extra: number, offset: number, maxPeriods: number) {
  const ppy = PERIODS_PER_YEAR[i.frequency];
  const r = i.annualRatePct / 100 / ppy;
  const n = Math.round(i.termYears * ppy);
  const pay = scheduledPayment(i, r, n);
  let bal = i.principalCents;
  let interest = 0;
  let paid = 0;
  let k = 0;
  while (k < maxPeriods && bal > 0) {
    const int = Math.round(Math.max(0, bal - offset) * r);
    let p = (i.repayment === "INTEREST_ONLY" ? int : pay) + extra;
    // The last scheduled payment clears whatever rounding left over.
    const last = k === n - 1 && maxPeriods >= n && i.repayment === "PRINCIPAL_AND_INTEREST";
    if (p > bal + int || last) p = bal + int;
    // A payment that does not even cover interest would never repay: stop rather than loop.
    if (p < int && i.repayment === "PRINCIPAL_AND_INTEREST") break;
    bal = bal + int - p;
    interest += int;
    paid += p;
    k++;
  }
  return { pay, k, interest, paid, bal };
}

export function calculate(i: CalcInput): CalcResult {
  const bad = validateInput(i);
  if (bad) throw new RangeError(bad);
  const ppy = PERIODS_PER_YEAR[i.frequency];
  const term = Math.round(i.termYears * ppy);
  const window = i.windowMonths !== undefined ? Math.min(term, Math.round((i.windowMonths / 12) * ppy)) : term;
  const extra = i.extraPerPeriodCents ?? 0;
  const offset = i.offsetCents ?? 0;
  const main = run(i, extra, offset, window);
  const out: CalcResult = {
    periodsPerYear: ppy,
    scheduledPaymentCents: main.pay,
    periodsRun: main.k,
    totalInterestCents: main.interest,
    totalPaidCents: main.paid,
    endBalanceCents: main.bal,
    repaidEarly: main.bal === 0 && main.k < term,
  };
  if (extra > 0 || offset > 0) {
    const base = run(i, 0, 0, window);
    out.interestSavedCents = base.interest - main.interest;
    out.periodsSaved = base.k - main.k;
  }
  return out;
}

export const dollarsFromCents = (c: number): string =>
  `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
