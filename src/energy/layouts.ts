/**
 * Band-hour layouts: the hours a plan's peak, shoulder and off-peak rates apply. A bill split
 * ("30% peak") only means something against the hours of the plan the bill came from, and those
 * differ between plans, so the invoice-first flow identifies the household's hours by layout
 * (add-energy-invoice-first). A layout is the sorted set of (season, band, days, start, end)
 * windows; its id is a short hash of that set. Nothing here reads a name, address or meter id.
 */
import { createHash } from "node:crypto";
import type { EnergyPlan, TariffPeriod, TimeWindow } from "./types.js";

export interface LayoutWindow {
  /** "year", or "MM-DD to MM-DD" for a seasonal tariff period. */
  season: string;
  band: string;
  /** Upper-case day codes, sorted in week order and joined with commas. */
  days: string;
  /** HH:MM, or "" when the published window has no time (all day). */
  start: string;
  end: string;
}

const WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const dayOrder = (d: string) => {
  const i = WEEK.indexOf(d);
  return i < 0 ? 99 : i;
};

/** CDR times are "HHMM" ("1500"); store them as "HH:MM" so equal hours always compare equal. */
function hhmm(t: string | undefined): string {
  const m = /^(\d{1,2}):?(\d{2})/.exec(t ?? "");
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
}

const seasonOf = (t: TariffPeriod) => (t.startDate && t.endDate ? `${t.startDate} to ${t.endDate}` : "year");

/** The windows of a plan's electricity or gas time-of-use rates, or undefined when it has none. */
export function layoutWindows(plan: EnergyPlan, fuel: "ELECTRICITY" | "GAS" = "ELECTRICITY"): LayoutWindow[] | undefined {
  const c = fuel === "ELECTRICITY" ? plan.electricity : plan.gas;
  const out: LayoutWindow[] = [];
  for (const t of c?.tariffPeriods ?? []) {
    for (const r of t.timeOfUse ?? []) {
      const ws: TimeWindow[] = r.windows.length ? r.windows : [{ days: [] }];
      for (const w of ws) {
        out.push({
          season: seasonOf(t),
          band: r.type,
          days: [...w.days].map((d) => d.toUpperCase()).sort((a, b) => dayOrder(a) - dayOrder(b)).join(","),
          start: hhmm(w.startTime),
          end: hhmm(w.endTime),
        });
      }
    }
  }
  if (out.length === 0) return undefined;
  return out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** A short, stable id for a set of windows. */
export function layoutId(windows: LayoutWindow[]): string {
  return createHash("sha256").update(JSON.stringify(windows)).digest("hex").slice(0, 8);
}

function clock(t: string, role: "start" | "end"): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h === 0 && min === 0) return "midnight";
  if (h === 24 && min === 0) return "midnight";
  if (h === 12 && min === 0) return role === "end" ? "noon" : "noon";
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min ? `:${String(min).padStart(2, "0")}` : ""}${suffix}`;
}

function dayWords(days: string): string {
  const set = new Set(days.split(",").filter(Boolean));
  if (set.size === 0 || set.size === 7) return "every day";
  const has = (xs: string[]) => xs.length === set.size && xs.every((x) => set.has(x));
  if (has(["MON", "TUE", "WED", "THU", "FRI"])) return "weekdays";
  if (has(["SAT", "SUN"])) return "weekends";
  return [...set].map((d) => d.slice(0, 1) + d.slice(1).toLowerCase()).join(", ");
}

const bandName = (b: string) =>
  b === "PEAK" ? "Peak" : b === "OFF_PEAK" ? "Off-peak" : /^SHOULDER(\d*)$/.test(b) ? `Shoulder${b.slice(8) ? ` ${b.slice(8)}` : ""}` : b.toLowerCase().replace(/_/g, " ");

/** The layout in plain words, for example "Peak 3pm to 9pm on weekdays; shoulder 7am to 3pm on weekdays". */
export function describeLayout(windows: LayoutWindow[]): string {
  const seasons = [...new Set(windows.map((w) => w.season))];
  const parts = seasons.map((s) => {
    const ws = windows.filter((w) => w.season === s);
    const bands = [...new Set(ws.map((w) => w.band))];
    const text = bands.map((b) => {
      const byDays = new Map<string, string[]>();
      for (const w of ws.filter((x) => x.band === b)) {
        const when = w.start || w.end ? `${clock(w.start || "00:00", "start")} to ${clock(w.end || "00:00", "end")}` : "all day";
        const k = dayWords(w.days);
        byDays.set(k, [...(byDays.get(k) ?? []), when]);
      }
      const pieces = [...byDays].map(([d, times]) => `${times.join(" and ")} on ${d}`);
      return `${bandName(b)} ${pieces.join(", ")}`;
    });
    return seasons.length > 1 ? `${s}: ${text.join("; ")}` : text.join("; ");
  });
  return parts.join(" | ");
}
