import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { stateOfPostcode } from "../energy/benchmarks/state.js";
import { annualExportKwh, annualKwh, buildProfile, encodeProfile, type ReadingsProfile } from "../energy/readings/profile.js";
import { MAX_READINGS_CHARS, parseNem12 } from "../energy/readings/parse.js";
import { badPostcode, checkPostcode } from "./energy-common.js";

const input = z.object({
  // No schema maximum on purpose: a longer text is refused by the parser with a plain message, not a protocol error.
  readingsText: z.string().min(20).describe(`The text of the household's own NEM12 interval meter data file (CSV), pasted unchanged, at most ${MAX_READINGS_CHARS.toLocaleString("en-AU")} characters (a year of 30-minute data with solar export fits). Ask the user to get it from their distributor or retailer, for one NMI`),
  postcode: z.string().describe("Four-digit postcode of the property, so daylight saving can be applied to the readings"),
});

export const READINGS_SOURCE = {
  name: "The household's own interval meter readings, supplied by the user (NEM12 format, AEMO Meter Data File Format Specification)",
  url: "https://www.aemo.com.au/",
  licence: "The household's own data, read in this request and not stored",
};
export const READINGS_NOTICE =
  "These figures come from the household's own readings file. The file was read for this request only, nothing was stored, and no meter or account identifier is kept or shown. General information only, not advice.";

export interface ReadingsSummary {
  postcode: string;
  state: string;
  period: { from: string; to: string };
  daysPresent: number;
  missingCount: number;
  missingDates: string[];
  totalKwh: number;
  /** The measured total scaled from the days present to 365 days. */
  annualKwh: number;
  solarExportKwh?: number;
  annualSolarExportKwh?: number;
  streams: { consumption: string[]; export: string[] };
  netOnly: boolean;
  qualityNote: string;
  notes: string[];
  /** Pass this string unchanged to compare_energy_plans as readingsProfile. */
  profile: string;
  notice: string;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function summaryOf(p: ReadingsProfile, postcode: string): ReadingsSummary {
  const notes: string[] = [];
  const full = p.daysPresent + p.missingCount;
  if (p.missingCount > 0) notes.push(`${p.missingCount} day${p.missingCount === 1 ? " is" : "s are"} missing inside the period${p.missingCount > p.missing.length ? " (first 31 listed)" : ""}; the annual figure is the measured total scaled from ${p.daysPresent} days to 365.`);
  else if (p.daysPresent !== 365) notes.push(`The readings cover ${p.daysPresent} days; the annual figure is the measured total scaled to 365 days.`);
  if (full < 90) notes.push("The readings cover under 90 days, so seasonal plans are less certain.");
  if (p.netOnly) notes.push("Only a net stream was in the file, so use is net of the household's own solar and solar export cannot be separated.");
  if (p.streams.consumption.filter((s) => s[0] === "E").length > 1) notes.push("More than one consumption stream (for example E1 and E2) was found. All are counted as main consumption; controlled load is not costed separately, so a controlled load circuit is costed at the general rate.");
  const q = p.variableDays || p.nonActualDays || p.outageIntervals ? `${p.variableDays} variable day${p.variableDays === 1 ? "" : "s"}, ${p.nonActualDays} other day${p.nonActualDays === 1 ? "" : "s"} with estimated or substituted data, ${p.outageIntervals} outage interval${p.outageIntervals === 1 ? "" : "s"}; figures are used as stated in the file.` : "All days are marked as actual meter data.";
  return {
    postcode,
    state: p.state,
    period: { from: p.from, to: p.to },
    daysPresent: p.daysPresent,
    missingCount: p.missingCount,
    missingDates: p.missing,
    totalKwh: r1(p.totalKwh),
    annualKwh: Math.round(annualKwh(p)),
    ...(p.exportKwh !== undefined ? { solarExportKwh: r1(p.exportKwh), annualSolarExportKwh: Math.round(annualExportKwh(p)!) } : {}),
    streams: p.streams,
    netOnly: p.netOnly,
    qualityNote: q,
    notes,
    profile: encodeProfile(p),
    notice: READINGS_NOTICE,
  };
}

export const summariseIntervalReadings = defineTool({
  name: "summarise_interval_readings",
  title: "Summarise interval readings",
  description:
    "Reads the household's own NEM12 interval meter data file (half-hourly kWh, a CSV the person gets from their distributor or retailer) and returns the period covered, days present and missing, total and annual kWh, any solar export, and a profile string. Pass the profile unchanged to compare_energy_plans as readingsProfile to estimate plans from the household's own use, including time-of-use plans. The file is read for this request only and nothing is stored; no meter or account identifier is returned. Reads 5, 15 and 30 minute intervals (summed to half hours). Refuses accumulation (NEM13) files, files with more than one NMI, files with no consumption stream and text over 250,000 characters (send a shorter period, or ask for 30-minute intervals).",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const state = stateOfPostcode(postcode);
    if (!state || state === "WA" || state === "NT") return notFound("outside_coverage", "Interval readings are used for NSW, VIC, QLD, SA, TAS and the ACT. Western Australia and the Northern Territory are outside the National Electricity Market and are not covered.");
    const parsed = parseNem12(args.readingsText);
    if (!parsed.ok) {
      return notFound("needs_input", `The readings file could not be used${parsed.line ? ` (line ${parsed.line})` : ""}: ${parsed.problem}. Ask the user to request interval readings (a NEM12 file, half-hourly kWh) from their distributor or retailer, for one NMI.`);
    }
    if (parsed.consumption.size === 0) return notFound("needs_input", "The readings file has no interval records. Ask the user for a NEM12 file with half-hourly data.");
    const profile = buildProfile(parsed, state);
    return found({ data: summaryOf(profile, postcode), source: READINGS_SOURCE, asOf: new Date(`${profile.to}T00:00:00Z`) });
  },
  render: (d) => {
    const lines = [
      `The household's own interval readings for postcode ${d.postcode} (${d.state}), ${d.period.from} to ${d.period.to}: ${d.daysPresent} days present${d.missingCount ? `, ${d.missingCount} missing${d.missingDates.length ? ` (${d.missingDates.join(", ")}${d.missingCount > d.missingDates.length ? ", ..." : ""})` : ""}` : ""}.`,
      "",
      `- Total use over those days: ${d.totalKwh} kWh. Scaled to a year: about ${d.annualKwh} kWh.`,
      ...(d.solarExportKwh !== undefined ? [`- Solar export (B stream): ${d.solarExportKwh} kWh over those days, about ${d.annualSolarExportKwh} kWh a year.`] : []),
      `- Streams used: consumption ${d.streams.consumption.join(", ") || "none"}${d.streams.export.length ? `; export ${d.streams.export.join(", ")}` : ""}.`,
      `- Data quality: ${d.qualityNote}`,
      ...d.notes.map((n) => `- ${n}`),
      "",
      "To estimate plans from this, call compare_energy_plans with the same postcode and fuelType ELECTRICITY and pass this profile unchanged as readingsProfile. Do not add up or re-state the half-hourly figures yourself.",
      "",
      `Profile: ${d.profile}`,
      "",
      d.notice,
    ];
    return lines.join("\n");
  },
});
