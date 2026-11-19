/**
 * The "ask for your interval readings" note (add-energy-readings-prompt). Interval readings are the most accurate
 * usage input, and a household can ask its retailer or distributor for them. Ask Righto does not request, receive or
 * read them; the note only says where to ask. Distributor request pages are hand-checked and dated in
 * `distributors.json`; a distributor with no checked page gets the generic note and no link. Fees and times are only
 * ever repeated from a distributor's own checked page (its `note`), never stated here.
 */
import distributorsJson from "./distributors.json" with { type: "json" };

export interface Distributor {
  name: string;
  aliases?: string[];
  states?: string[];
  /** The distributor's own meter data request page, hand-checked. */
  requestUrl?: string;
  checkedAt?: string;
  /** What that page states about fees or time, in our words. Only with requestUrl. */
  note?: string;
  /** Why there is no checked page. Exactly one of requestUrl or none. */
  none?: string;
}

export const DISTRIBUTORS = distributorsJson as Distributor[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Matches a distributor name as retailers spell it (case and punctuation ignored) by name or alias. */
export function matchDistributor(name: string | undefined, list: readonly Distributor[] = DISTRIBUTORS): Distributor | undefined {
  if (!name) return undefined;
  const n = norm(name);
  return list.find((d) => norm(d.name) === n || (d.aliases ?? []).some((a) => norm(a) === n));
}

export interface ReadingsNote {
  /** Full note for markdown and the structured data. */
  text: string;
  /** One line for places with a length cap. */
  short: string;
  /** Present only when the distributor has a checked request page. */
  distributor?: { name: string; url: string; checkedAt: string; note?: string };
}

export const READINGS_SHORT = "Ask the retailer or distributor for interval readings for a more accurate comparison.";

const GENERIC =
  "For a more accurate comparison, ask the retailer or the electricity distributor for the interval readings (the household's use in half-hour steps), often for up to the last two years. The NMI printed on a bill is needed. Interval readings are also what would let time-of-use plans be compared. Ask Righto does not request the readings for the household. With the file, it can estimate plans from it for that request only; nothing is stored.";

/** The note, with the distributor's checked request page where the name matches one. */
export function readingsNote(distributorName?: string, list: readonly Distributor[] = DISTRIBUTORS): ReadingsNote {
  const d = matchDistributor(distributorName, list);
  if (!d?.requestUrl || !d.checkedAt) return { text: GENERIC, short: READINGS_SHORT };
  const line = `The distributor here is ${d.name}: [its meter data request page](${d.requestUrl}) (checked ${d.checkedAt}).${d.note ? ` ${d.note}` : ""}`;
  return { text: `${GENERIC} ${line}`, short: READINGS_SHORT, distributor: { name: d.name, url: d.requestUrl, checkedAt: d.checkedAt, ...(d.note ? { note: d.note } : {}) } };
}

/**
 * Wording check: the note may not state a fee, a time or Ask Righto handling the data unless the words come from a
 * distributor's checked page (its `note`). Returns the problems found; empty means fine.
 */
export function readingsWordingProblems(note: ReadingsNote): string[] {
  const text = note.distributor?.note ? note.text.replace(note.distributor.note, "") : note.text;
  const problems: string[] = [];
  if (/\bfree\b|\bfees?\b|\bcharges?\b|\bcosts?\b|\$\s?\d|no cost/i.test(text)) problems.push("states a fee or cost without a source");
  if (/\bwithin\s+\d|\b\d+\s*(business\s+)?(days?|hours?|weeks?)\b|\binstantly\b|\bimmediately\b|\bsame day\b/i.test(text)) problems.push("states a time without a source");
  if (/\bwe(?:'ll| will| can)?\s+(request|ask|fetch|get|collect|read|receive|process|store|upload)\b|\bsend (it|them|the (file|data|readings)) to (us|Ask Righto)\b|\bupload\b/i.test(text)) problems.push("implies Ask Righto handles the readings");
  return problems;
}
