/**
 * One display name per brand. Retailers publish their brand name on every plan and spell it
 * differently from plan to plan ("GloBird Energy" and "Globird Energy", "Dodo" and
 * "Dodo Power & Gas", "Lumo Energy" and "Lumo Energy (SA)"). Left alone, one brand shows up as
 * several in lists and the retailer filter splits it. The raw payload keeps what was published;
 * only the normalised brand name is canonical.
 */
import retailersJson from "./retailers.json" with { type: "json" };

/** Brands served from another retailer's path (docs/energy-data.md) and brands seen on real plans under a different name. */
const EXTRA_BRANDS = [
  "ARCLINE",
  "Cooperative Power",
  "RAA Energy",
  "Indigo Power",
  "Sonnen",
  "iO Energy",
  "MYOB",
  "OVO Energy for CTM",
  "SunSwitch",
];

/** Words that differ between spellings of one brand and say nothing about which brand it is. */
const GENERIC = new Set(["energy", "power", "gas", "electricity", "retail", "retailer", "group", "holdings", "pty", "ltd", "the", "and"]);

/** Comparison key: lowercase, no bracketed suffix such as "(SA)", no generic words, letters and digits only. */
export function brandKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const kept = words.filter((w) => !GENERIC.has(w));
  // A name made only of generic words keeps them rather than collapsing to an empty key.
  return (kept.length ? kept : words).join("");
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const CANONICAL = new Map<string, string>();
for (const name of [...(retailersJson as Array<{ brandName: string }>).map((r) => r.brandName), ...EXTRA_BRANDS]) {
  const k = brandKey(name);
  if (k && !CANONICAL.has(k)) CANONICAL.set(k, name);
}

/**
 * The canonical name for a published brand name. A name that matches no known brand is kept as
 * published, with spacing tidied.
 */
export function canonicalBrand(published: string): string {
  const tidy = collapse(published);
  return CANONICAL.get(brandKey(tidy)) ?? tidy;
}
