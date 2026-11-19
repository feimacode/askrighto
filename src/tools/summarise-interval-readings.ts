import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { DEFAULT_MAX_CHARS, parseNem12, ReadingsError } from "../energy/readings/nem12.js";
import { annualExportKwh, annualKwh, buildProfile, encodeProfile } from "../energy/readings/profile.js";

const input = z.object({
  readingsText: z.string().min(1).max(2_000_000).describe("The full text of the NEM12 interval readings file the household got from its retailer or distributor, pasted exactly as it is"),
});

export const READINGS_SOURCE = {
  name: "The household's own interval readings, supplied by the user (file layout: AEMO Meter Data File Format specification, NEM12)",
  url: "https://www.aemo.com.au/Electricity/National-Electricity-Market-NEM/Retail-and-metering/Metering-procedures-guidelines-and-processes",
  licence: "The household's own data, used for this request only and not stored. The file format is AEMO's, described here in our own words.",
};

export const READINGS_NOTICE =
  "These figures are worked out from the household's own interval readings for the period shown, in market time (Australian Eastern Standard Time, no daylight saving). They are one past year of use, not a forecast, and not advice.";

interface SummaryData {
  period: { start: string; end: string };
  daysPresent: number;
  missingDates: string[];
  missingCount: number;
  measuredKwh: number;
  annualKwh: number;
  scaledToYear: boolean;
  exportKwh?: number;
  annualExportKwh?: number;
  streams: { consumption: string[]; export: string[]; ignored: string[] };
  netOnly: boolean;
  quality: { dayFlags: Record<string, number>; nonActualIntervals: number; outageEvents: number };
  omissions: string[];
  profile: string;
  notice: string;
}

const kwh = (x: number) => `${Math.round(x).toLocaleString("en-AU")} kWh`;

export const summariseIntervalReadings = defineTool({
  name: "summarise_interval_readings",
  title: "Summarise interval readings",
  description:
    "Reads the text of a household's NEM12 interval readings file (half-hourly meter data the household asked its retailer or distributor for) and returns the period covered, days present and missing, total kWh, solar export if the file has it, and a compact profile string. Pass the profile string, unchanged, to compare_energy_plans as readingsProfile to cost plans from the household's own use, including time-of-use plans. The file is read in memory and nothing is stored; the meter identifier is dropped and never returned. Refuses accumulation (NEM13) files, files with more than one meter point and files with no consumption stream. Never add up the figures yourself.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: (args) => {
    let parsed;
    try {
      parsed = parseNem12(args.readingsText, DEFAULT_MAX_CHARS);
    } catch (e) {
      if (e instanceof ReadingsError) return notFound("needs_input", e.message);
      throw e;
    }
    const profile = buildProfile(parsed);
    const hasExport = parsed.streams.export.length > 0;
    const omissions = [
      "Controlled load is not costed separately: every E stream counts as main consumption, because a controlled load circuit cannot be told apart by its stream suffix.",
      ...(parsed.netOnly ? ["The file has only a net stream (consumption net of the household's own solar), so solar export cannot be separated."] : []),
    ];
    const data: SummaryData = {
      period: { start: parsed.start, end: parsed.end },
      daysPresent: parsed.daysPresent,
      missingDates: parsed.missingDates.slice(0, 31),
      missingCount: parsed.missingDates.length,
      measuredKwh: Math.round(profile.kwh * 100) / 100,
      annualKwh: Math.round(annualKwh(profile)),
      scaledToYear: parsed.daysPresent !== 365,
      ...(hasExport ? { exportKwh: Math.round(profile.exportKwh * 100) / 100, annualExportKwh: Math.round(annualExportKwh(profile)) } : {}),
      streams: parsed.streams,
      netOnly: parsed.netOnly,
      quality: parsed.quality,
      omissions,
      profile: encodeProfile(profile),
      notice: READINGS_NOTICE,
    };
    return found({ data, source: READINGS_SOURCE, asOf: new Date(`${parsed.end}T00:00:00Z`) });
  },
  render: (d) =>
    [
      `Readings from ${d.period.start} to ${d.period.end}: ${d.daysPresent} days present${d.missingCount ? `, ${d.missingCount} missing${d.missingDates.length ? ` (${d.missingDates.join(", ")}${d.missingCount > d.missingDates.length ? " and more" : ""})` : ""}` : ""}.`,
      `Measured use: ${kwh(d.measuredKwh)}${d.scaledToYear ? `; scaled to a full year (x 365/${d.daysPresent}) that is ${kwh(d.annualKwh)}` : ""}.`,
      ...(d.exportKwh !== undefined ? [`Solar export (B stream): ${kwh(d.exportKwh)} measured${d.scaledToYear ? `, ${kwh(d.annualExportKwh!)} scaled to a year` : ""}.`] : []),
      `Data streams read: consumption ${d.streams.consumption.join(", ")}${d.streams.export.length ? `; export ${d.streams.export.join(", ")}` : ""}${d.streams.ignored.length ? `; ignored ${d.streams.ignored.join(", ")}` : ""}.`,
      `Quality: days by flag ${Object.entries(d.quality.dayFlags).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}; ${d.quality.nonActualIntervals} intervals not actual reads; ${d.quality.outageEvents} outage events.`,
      "",
      "Left out:",
      ...d.omissions.map((o) => `- ${o}`),
      "",
      "Profile (pass this string, unchanged, as readingsProfile to compare_energy_plans):",
      d.profile,
      "",
      d.notice,
    ].join("\n"),
});
