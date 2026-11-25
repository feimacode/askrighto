import { notFound } from "../../core/grounded.js";
import type { BenchmarkFigure } from "../benchmarks/lookup.js";
import { stateOfPostcode } from "../benchmarks/state.js";
import type { Usage, UsageBasis } from "../calc.js";
import { annualExportKwh, annualKwh, decodeProfile, type ReadingsProfile } from "../readings/profile.js";
import { bandShares, periodMonths } from "../readings/windows.js";

/** The fields of the compare input that say how much energy the household uses. */
export interface UsageArgs {
  fuelType: "ELECTRICITY" | "GAS";
  annualUsageKwh?: number;
  billUsageKwh?: number;
  annualUsageMj?: number;
  billUsageMj?: number;
  billDays?: number;
  peakSharePct?: number;
  shoulderSharePct?: number;
  offPeakSharePct?: number;
  householdSize?: number;
  useBenchmarkUsage?: boolean;
  readingsProfile?: string;
  controlledLoadAnnualKwh?: number;
  solarExportAnnualKwh?: number;
}

export interface ResolvedUsage {
  unit: "kWh" | "MJ";
  /** Undefined when typical usage was asked for: the handler looks the AER benchmark up in the store. */
  annual?: number;
  useBenchmark: boolean;
  scaledFromBill?: string;
  profile?: ReadingsProfile;
  readingsVerified: boolean;
  ignored?: string;
  shares?: Usage["shares"];
}

export type UsageResolution = { ok: true; usage: ResolvedUsage } | { ok: false; result: ReturnType<typeof notFound> };

const refuse = (message: string): UsageResolution => ({ ok: false, result: notFound("needs_input", message) });

/**
 * Works out which usage evidence the call carries: readings, a yearly figure, a bill scaled by its days, or typical usage.
 * Pure: it reads no store. Fields that do not fit the path taken are dropped, as the handler always did.
 */
export function resolveUsage(args: UsageArgs, ctx: { postcode: string; customerType: "RESIDENTIAL" | "BUSINESS" }): UsageResolution {
  const { postcode, customerType } = ctx;
  const elec = args.fuelType === "ELECTRICITY";
  const annualDirect = elec ? args.annualUsageKwh : args.annualUsageMj;
  const bill = elec ? args.billUsageKwh : args.billUsageMj;
  const unit = elec ? "kWh" : "MJ";
  let annual = annualDirect;
  let scaledFromBill: string | undefined;
  // The household's own interval readings, if the host passed a profile back. Revalidated here, never trusted.
  let profile: ReadingsProfile | undefined;
  let ignored: string | undefined;
  let readingsVerified = true;
  if (args.readingsProfile !== undefined) {
    if (!elec) return refuse("Interval readings apply to electricity only. Call again with fuelType ELECTRICITY, or without readingsProfile.");
    const d = decodeProfile(args.readingsProfile);
    if (!d.ok) return refuse(`The readings profile could not be used: ${d.problem}. Ask the user for their readings file and call summarise_interval_readings again, then pass its profile unchanged.`);
    const st = stateOfPostcode(postcode);
    if (st !== d.profile.state) return refuse(`The profile was built for a ${d.profile.state} postcode (daylight saving is applied by state) but this postcode is in ${st ?? "an unsupported place"}. Call summarise_interval_readings again with this postcode.`);
    profile = d.profile;
    readingsVerified = d.verified;
    const dropped = [annualDirect !== undefined || bill !== undefined ? "the bill or yearly usage figure" : "", args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined ? "the peak, shoulder and off-peak split" : ""].filter(Boolean);
    if (dropped.length) ignored = `The readings were used; ${dropped.join(" and ")} given with them was not used.`;
    annual = annualKwh(profile);
  }
  if (!profile && annual === undefined && bill !== undefined) {
    if (!args.billDays) return refuse(`A bill's ${unit} figure needs the number of days the bill covers. Ask the user for billDays.`);
    annual = (bill * 365) / args.billDays;
    scaledFromBill = `${bill} ${unit} over ${args.billDays} days scaled to a year (x 365/${args.billDays}); real use varies with the seasons`;
  }
  if (annual === undefined) {
    if (!args.useBenchmarkUsage) {
      return refuse(
        `No usage was given. Ask the user for the ${unit} used and the number of days from a recent bill (or their yearly ${unit}), then call again. ${customerType === "BUSINESS" ? "There is no typical usage for a business: if there is no bill, ask for interval readings or a bill." : "If they have no bill to hand, you may offer typical usage for a household of their size: ask how many people live there (1 to 5, 5 meaning five or more), then call again with useBenchmarkUsage true and householdSize, and say it is typical usage, not their own."}`,
      );
    }
    if (customerType === "BUSINESS") return refuse("Typical usage is for households only: there is no benchmark for a business. Ask the user for the usage on a recent bill, or their interval readings, then call again.");
    if (args.householdSize === undefined) return refuse("Typical usage needs the household size. Ask the user how many people live there (1 to 5, 5 meaning five or more), then call again with householdSize.");
    if (args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined || args.controlledLoadAnnualKwh || args.solarExportAnnualKwh) {
      return refuse("Peak and off-peak shares, controlled load and solar export come from a bill and cannot be combined with typical usage. Ask the user for the usage on a recent bill, or call again without those figures.");
    }
  }
  const useBenchmark = annual === undefined;
  let shares: Usage["shares"];
  if (!useBenchmark && !profile && (args.peakSharePct !== undefined || args.shoulderSharePct !== undefined || args.offPeakSharePct !== undefined)) {
    if (!elec) return refuse("Peak and off-peak shares apply to electricity only.");
    shares = { peak: args.peakSharePct ?? 0, shoulder: args.shoulderSharePct ?? 0, offPeak: args.offPeakSharePct ?? 0 };
    const sum = shares.peak + shares.shoulder + shares.offPeak;
    if (Math.abs(sum - 100) > 0.5) return refuse(`The peak, shoulder and off-peak shares add up to ${sum}%, not 100%. Ask the user to check the split on their bill.`);
  }
  return {
    ok: true,
    usage: {
      unit,
      ...(annual !== undefined ? { annual } : {}),
      useBenchmark,
      ...(scaledFromBill ? { scaledFromBill } : {}),
      ...(profile ? { profile } : {}),
      readingsVerified,
      ...(ignored ? { ignored } : {}),
      ...(shares ? { shares } : {}),
    },
  };
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
    const ex = annualExportKwh(pr) ?? args.solarExportAnnualKwh;
    if (ex) usage.solarExportAnnualKwh = ex;
    if (args.controlledLoadAnnualKwh) usage.controlledLoadAnnualKwh = args.controlledLoadAnnualKwh;
  }
  return usage;
}
