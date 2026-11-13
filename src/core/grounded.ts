/**
 * The grounded result envelope. Every fact a tool returns travels in one of two
 * shapes: found, with its source and as-of date, or not found, with a reason.
 * There is no third shape, so a tool cannot return a figure without saying where
 * it came from and when it was current.
 */

export interface Source {
  /** Publisher and dataset, e.g. "Australian Energy Regulator, energy product reference data". */
  name: string;
  /** Where a person can check the data. */
  url: string;
  /** Licence or reuse basis, e.g. "CC BY 3.0 AU". */
  licence: string;
  /** Attribution notice the licence requires, shown with every result. */
  attribution?: string;
}

export type NotFoundReason =
  | "not_in_dataset"
  | "outside_coverage"
  | "no_data_loaded"
  | "data_unavailable"
  | "needs_input";

export interface Found<T> {
  found: true;
  data: T;
  source: Source;
  /** ISO 8601: when the data was last current at the source or last fetched. */
  asOf: string;
  warnings?: string[];
}

export interface NotFound {
  found: false;
  reason: NotFoundReason;
  /** Plain-language explanation the host can show the user. */
  message: string;
  /** Extra facts that help the host recover, e.g. the list of states covered. Never figures. */
  details?: Record<string, unknown>;
}

export type Grounded<T> = Found<T> | NotFound;

export function found<T>(args: { data: T; source: Source; asOf: string | Date; warnings?: string[] }): Found<T> {
  const asOf = args.asOf instanceof Date ? args.asOf.toISOString() : args.asOf;
  if (Number.isNaN(Date.parse(asOf))) throw new Error(`asOf is not a valid date-time: ${String(args.asOf)}`);
  if (!args.source.name || !args.source.url || !args.source.licence) {
    throw new Error("A found result needs source.name, source.url and source.licence");
  }
  return { found: true, data: args.data, source: args.source, asOf, ...(args.warnings?.length ? { warnings: args.warnings } : {}) };
}

export function notFound(reason: NotFoundReason, message: string, details?: Record<string, unknown>): NotFound {
  return { found: false, reason, message, ...(details ? { details } : {}) };
}

/** The fixed footer that ends the text form of every found result. */
export function sourceFooter(r: Found<unknown>): string {
  const lines = [`Source: ${r.source.name} (${r.source.url}), licence: ${r.source.licence}. As of ${r.asOf}.`];
  if (r.source.attribution) lines.push(r.source.attribution);
  return lines.join("\n");
}

/** Text form: body, warnings, then the source footer. Not-found results are just the message. */
export function renderText<T>(r: Grounded<T>, body: (data: T) => string): string {
  if (!r.found) return r.message;
  const parts = [body(r.data).trim()];
  if (r.warnings?.length) parts.push(r.warnings.map((w) => `Warning: ${w}`).join("\n"));
  parts.push(sourceFooter(r));
  return parts.filter(Boolean).join("\n\n");
}
