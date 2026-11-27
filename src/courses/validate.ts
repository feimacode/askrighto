/** Parsing and validation of the per-university provider index file. Links only: no course facts. */
import { parse } from "yaml";
import type { Provider, ProviderFile } from "./types.js";

export interface ValidateOptions {
  file?: string;
}

const hostOf = (url: string): string | undefined => {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
};
const onDomain = (host: string, domains: readonly string[]) =>
  domains.some((d) => host === d || host.endsWith("." + d));

/** Parses one provider file. Returns the provider and every problem found (an empty list means valid). */
export function parseProviderFile(
  text: string,
  opts: ValidateOptions = {},
): { file?: ProviderFile; errors: string[] } {
  const where = opts.file ? `${opts.file}: ` : "";
  let raw: { provider?: Provider; courses?: unknown };
  try {
    raw = parse(text) as typeof raw;
  } catch (e) {
    return { errors: [`${where}not valid YAML: ${(e as Error).message}`] };
  }
  const p = raw?.provider;
  if (
    !p ||
    !p.id ||
    !p.name ||
    !p.coursesUrl ||
    !Array.isArray(p.domains) ||
    p.domains.length === 0
  )
    return {
      errors: [`${where}provider needs id, name, coursesUrl and domains`],
    };
  const errors: string[] = [];
  if (raw.courses !== undefined)
    errors.push(
      `${where}${p.id}: course rows are not stored any more; keep only the provider block`,
    );
  const domains = p.domains.map((d) => d.toLowerCase());
  for (const [label, url] of [
    ["coursesUrl", p.coursesUrl],
    ["searchUrl", p.searchUrl],
  ] as const) {
    if (!url) continue;
    const h = hostOf(url);
    if (!h) errors.push(`${where}${p.id}: ${label} is not a web address`);
    else if (!onDomain(h, domains))
      errors.push(
        `${where}${p.id}: ${label} ${h} is not on the provider's domains (${domains.join(", ")})`,
      );
  }
  return errors.length ? { errors } : { file: { provider: p }, errors };
}
