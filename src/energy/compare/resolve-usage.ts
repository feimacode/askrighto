import { notFound } from "../../core/grounded.js";
import type { BenchmarkFigure } from "../benchmarks/lookup.js";
import { stateOfPostcode } from "../benchmarks/state.js";
import type { Usage, UsageBasis } from "../calc.js";
import { annualExportKwh, annualKwh, decodeProfile, type ReadingsProfile } from "../readings/profile.js";
import { bandShares, periodMonths } from "../readings/windows.js";

/**
 * The ladder of usage evidence, best first (restructure-energy-compare-usage). Each level ends in the same result,
 * a yearly cost per plan; only the evidence behind the usage changes.
 */
export const USAGE_SOURCES = ["readings", "assistant_readings", "bill", "yearly", "typical"] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

/** The fields of the compare input that say how much energy the household uses. */
export interface UsageArgs {
  fuelType: "ELECTRICITY" | "GAS";
  usageSource: UsageSource;
  /** kWh for electricity, MJ for gas. A bill's figure for `bill` and `assistant_readings`, a year's for `yearly`. */
  usage?: number;
  usageDays?: number;
  peakSharePct?: number;
  shoulderSharePct?: number;
  offPeakSharePct?: number;
  householdSize?: number;
  readingsProfile?: string;
  currentPlanId?: string;
  hoursLayoutId?: string;
  controlledLoadAnnualKwh?: number;
  solarExportAnnualKwh?: number;
}

export interface ResolvedUsage {
  level: UsageSource;
  unit: "kWh" | "MJ";
  /** Undefined for typical usage: the handler looks the AER benchmark up in the store. */
  annual?: number;
  /** Days a bill or the assistant's readings cover. */
  days?: number;
  scaledFromBill?: string;
  profile?: ReadingsProfile;
  readingsVerified: boolean;
  shares?: Usage["shares"];
  /** Non-fatal notes for the result. */
  warnings: string[];
}

export type UsageResolution = { ok: true; usage: ResolvedUsage } | { ok: false; result: ReturnType<typeof notFound> };

const refuse = (message: string): UsageResolution => ({ ok: false, result: notFound("needs_input", message) });

/** Fields a source may be given, besides `fuelType` and the plan filters. Anything else is refused. */
const BILL_FIELDS = ["usage", "usageDays", "peakSharePct", "shoulderSharePct", "offPeakSharePct", "currentPlanId", "hoursLayoutId", "controlledLoadAnnualKwh", "solarExportAnnualKwh"] as const;
const ALLOWED: Record<UsageSource, readonly string[]> = {
  readings: ["readingsProfile", "controlledLoadAnnualKwh", "currentPlanId", "hoursLayoutId"],
  assistant_readings: BILL_FIELDS,
  bill: BILL_FIELDS,
  yearly: BILL_FIELDS.filter((f) => f !== "usageDays"),
  typical: ["householdSize"],
};
const CHECKED = ["readingsProfile", "usage", "usageDays", "peakSharePct", "shoulderSharePct", "offPeakSharePct", "householdSize", "currentPlanId", "hoursLayoutId", "controlledLoadAnnualKwh", "solarExportAnnualKwh"] as const;
/** Fields that only mean something for electricity. */
const ELECTRICITY_ONLY = ["readingsProfile", "peakSharePct", "shoulderSharePct", "offPeakSharePct", "controlledLoadAnnualKwh", "solarExportAnnualKwh"] as const;

const SPLIT = ["peakSharePct", "shoulderSharePct", "offPeakSharePct"] as const;
const DAYS_FIELD_HINT = "Ask the user for the number of days the figure covers.";

/**
 * Works out which usage evidence the call carries and checks every field against it. A field that does not belong to
 * the chosen source, or to the fuel, is refused with its name, never dropped. Pure: it reads no store.
 */
export function resolveUsage(args: UsageArgs, ctx: { postcode: string; customerType: "RESIDENTIAL" | "BUSINESS" }): UsageResolution {
  const { postcode, customerType } = ctx;
  const source = args.usageSource;
  const elec = args.fuelType === "ELECTRICITY";
  const unit = elec ? "kWh" : "MJ";
  const given = (f: string) => (args as unknown as Record<string, unknown>)[f] !== undefined;

  if (!elec && (source === "readings" || source === "assistant_readings")) {
    return refuse(`usageSource \`${source}\` is for electricity only: interval readings have no gas equivalent here. Call again with fuelType ELECTRICITY, or with usageSource \`bill\` or \`yearly\` for gas.`);
  }
  for (const f of CHECKED) {
    if (given(f) && !ALLOWED[source].includes(f)) {
      return refuse(`\`${f}\` is not used with usageSource \`${source}\`. Call again without it, or with the source it belongs to.`);
    }
  }
  if (!elec) {
    for (const f of ELECTRICITY_ONLY) {
      if (given(f)) return refuse(`\`${f}\` applies to electricity only, not gas. Call again without it.`);
    }
  }
  if (source === "typical" && customerType === "BUSINESS") {
    return refuse("Typical usage is for households only: there is no benchmark for a business. Ask the user for the usage on a recent bill, or their interval readings, then call again.");
  }

  const warnings: string[] = [];
  const base = { level: source, unit, warnings, readingsVerified: true } as const;

  if (source === "typical") {
    if (args.householdSize === undefined) return refuse("usageSource `typical` needs `householdSize`. Ask the user how many people live there (1 to 5, 5 meaning five or more), then call again.");
    return { ok: true, usage: { ...base } };
  }

  if (source === "readings") {
    if (args.readingsProfile === undefined) return refuse("usageSource `readings` needs `readingsProfile`: the profile string returned by summarise_interval_readings, passed unchanged.");
    // The household's own interval readings, if the host passed a profile back. Revalidated here, never trusted.
    const d = decodeProfile(args.readingsProfile);
    if (!d.ok) return refuse(`The readings profile could not be used: ${d.problem}. Ask the user for their readings file and call summarise_interval_readings again, then pass its profile unchanged.`);
    const st = stateOfPostcode(postcode);
    if (st !== d.profile.state) return refuse(`The profile was built for a ${d.profile.state} postcode (daylight saving is applied by state) but this postcode is in ${st ?? "an unsupported place"}. Call summarise_interval_readings again with this postcode.`);
    keepHoursWarning(args, warnings);
    return { ok: true, usage: { ...base, annual: annualKwh(d.profile), profile: d.profile, readingsVerified: d.verified } };
  }

  // bill, assistant_readings and yearly all start from `usage`.
  if (args.usage === undefined) return refuse(`usageSource \`${source}\` needs \`usage\`: the ${unit} ${source === "yearly" ? "used in a year" : source === "bill" ? "on the bill" : "summed from the readings"}. Ask the user for it, then call again.`);
  if (elec && args.usage > 1_000_000) return refuse("`usage` is more than 1,000,000 kWh, which is out of range for a household or small business. Check the figure with the user.");

  let annual = args.usage;
  let days: number | undefined;
  let scaledFromBill: string | undefined;
  if (source !== "yearly") {
    if (!args.usageDays) return refuse(`usageSource \`${source}\` needs \`usageDays\`, the number of days the \`usage\` covers. ${DAYS_FIELD_HINT}`);
    days = args.usageDays;
    annual = (args.usage * 365) / days;
    scaledFromBill = source === "bill"
      ? `${args.usage} ${unit} over ${days} days scaled to a year (x 365/${days}); real use varies with the seasons`
      : `${args.usage} ${unit} from the household's own readings over ${days} days, summed by the assistant, scaled to a year (x 365/${days}); real use varies with the seasons`;
  }

  let shares: Usage["shares"];
  if (SPLIT.some(given)) {
    shares = { peak: args.peakSharePct ?? 0, shoulder: args.shoulderSharePct ?? 0, offPeak: args.offPeakSharePct ?? 0 };
    const sum = shares.peak + shares.shoulder + shares.offPeak;
    if (Math.abs(sum - 100) > 0.5) return refuse(`The peak, shoulder and off-peak shares add up to ${sum}%, not 100%. Ask the user to check the split on their bill.`);
  }
  if (source === "assistant_readings") {
    if (!shares) return refuse("usageSource `assistant_readings` needs the peak, shoulder and off-peak split (`peakSharePct`, `shoulderSharePct`, `offPeakSharePct`) of the readings, banded by the household's current plan's hours.");
    if (!args.currentPlanId && !args.hoursLayoutId) return refuse("usageSource `assistant_readings` needs `currentPlanId` or `hoursLayoutId`: the hours the readings were banded by decide which time-of-use plans are exact. Call list_current_plan_options and let the user pick, then call again.");
  }
  if (!shares) keepHoursWarning(args, warnings);

  return { ok: true, usage: { ...base, annual, ...(days ? { days } : {}), ...(scaledFromBill ? { scaledFromBill } : {}), ...(shares ? { shares } : {}) } };
}

/** A current plan or hours layout needs a split to matter; it is kept for the baseline, and the result says it was not needed. */
function keepHoursWarning(args: UsageArgs, warnings: string[]): void {
  const f = args.currentPlanId ? "currentPlanId" : args.hoursLayoutId ? "hoursLayoutId" : undefined;
  if (f) warnings.push(`\`${f}\` was given without a peak, shoulder and off-peak split, so the current plan's hours were not needed for this comparison.`);
}

/** The cost model's usage, from the resolved evidence and, for typical usage, the benchmark figure the handler looked up. */
export function toCalcUsage(r: ResolvedUsage, args: UsageArgs, figure?: BenchmarkFigure): Usage {
  const elec = args.fuelType === "ELECTRICITY";
  const annual = figure ? figure.annual : r.annual!;
  const basis: UsageBasis = r.profile ? "readings" : figure ? "benchmark" : "customer";
  const usage: Usage = {
    fuel: args.fuelType,
    annualUsage: annual,
    basis,
    ...(r.shares ? { shares: r.shares } : {}),
    ...(basis === "customer" && elec && args.controlledLoadAnnualKwh ? { controlledLoadAnnualKwh: args.controlledLoadAnnualKwh } : {}),
    ...(basis === "customer" && elec && args.solarExportAnnualKwh ? { solarExportAnnualKwh: args.solarExportAnnualKwh } : {}),
  };
  if (r.profile) {
    const pr = r.profile;
    usage.sharesFor = (t) => {
      const b = bandShares(pr, t.timeOfUse ?? [], periodMonths(t));
      return b.ok ? { ok: true, shares: b.byBand } : { ok: false, reason: b.reason };
    };
    // The profile carries export from its own B streams; a controlled load total is the one extra a readings call may add.
    const ex = annualExportKwh(pr);
    if (ex) usage.solarExportAnnualKwh = ex;
    if (args.controlledLoadAnnualKwh) usage.controlledLoadAnnualKwh = args.controlledLoadAnnualKwh;
  }
  return usage;
}
