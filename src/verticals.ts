/**
 * Verticals: the unit that is loaded, served on the public route, or kept to the internal route.
 * `ASKRIGHTO_VERTICALS` names what the process loads (default `energy`); `ASKRIGHTO_PUBLIC_VERTICALS`
 * names what `/mcp` serves (default: everything loaded). Each route builds its tools, instructions and
 * data-source list from its own verticals, so a public client cannot see or call an internal-only tool.
 */
import { notFound } from "./core/grounded.js";
import type { AnyToolDefinition } from "./core/define-tool.js";
import { makeListDataSources } from "./tools/list-data-sources.js";

export const KNOWN_VERTICALS = ["energy", "courses", "international"] as const;

export interface Vertical {
  id: (typeof KNOWN_VERTICALS)[number];
  tools: readonly AnyToolDefinition[];
  /** Host guidance added to the server instructions on routes that serve this vertical. */
  instructions: string;
  /** Loads the vertical's data and registers its datasets and readiness checks. Returns a stop function. */
  start(env: NodeJS.ProcessEnv): Promise<(() => Promise<void>) | undefined>;
}

export interface VerticalFlags {
  loaded: string[];
  public: string[];
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Parses the two lists. Throws on an unknown name, an empty list, or a public vertical that is not loaded. */
export function parseVerticalFlags(
  env: NodeJS.ProcessEnv = process.env,
): VerticalFlags {
  const loaded =
    env.ASKRIGHTO_VERTICALS === undefined
      ? ["energy"]
      : list(env.ASKRIGHTO_VERTICALS);
  const pub =
    env.ASKRIGHTO_PUBLIC_VERTICALS === undefined
      ? loaded
      : list(env.ASKRIGHTO_PUBLIC_VERTICALS);
  const known = KNOWN_VERTICALS as readonly string[];
  for (const [name, ids] of [
    ["ASKRIGHTO_VERTICALS", loaded],
    ["ASKRIGHTO_PUBLIC_VERTICALS", pub],
  ] as const) {
    if (ids.length === 0)
      throw new Error(
        `${name} is empty; name at least one vertical (${known.join(", ")})`,
      );
    const bad = ids.find((id) => !known.includes(id));
    if (bad)
      throw new Error(
        `${name} names unknown vertical "${bad}" (known: ${known.join(", ")})`,
      );
  }
  const notLoaded = pub.find((id) => !loaded.includes(id));
  if (notLoaded)
    throw new Error(
      `ASKRIGHTO_PUBLIC_VERTICALS names "${notLoaded}", which ASKRIGHTO_VERTICALS does not load`,
    );
  return { loaded, public: pub };
}

const failed = new Map<string, string>();

export function markVerticalFailed(id: string, reason: string): void {
  failed.set(id, reason);
}
export function failedVerticals(): Record<string, string> {
  return Object.fromEntries(failed);
}
export function clearFailedVerticals(): void {
  failed.clear();
}

/** A tool whose vertical failed to start: same listing, but it only answers data_unavailable. */
function stub(tool: AnyToolDefinition): AnyToolDefinition {
  return {
    ...tool,
    datasets: undefined,
    handler: () =>
      notFound(
        "data_unavailable",
        "This part of Ask Righto failed to start, so it cannot answer right now.",
      ),
  };
}

export interface RouteSet {
  tools: AnyToolDefinition[];
  instructions: string[];
}

/** Everything a route serves, from the verticals it is allowed to show. */
export function routeSet(
  all: readonly Vertical[],
  ids: readonly string[],
): RouteSet {
  const chosen = all.filter((v) => ids.includes(v.id));
  const tools = chosen.flatMap((v) =>
    failed.has(v.id) ? v.tools.map(stub) : [...v.tools],
  );
  tools.push(makeListDataSources(ids));
  return { tools, instructions: chosen.map((v) => v.instructions) };
}
