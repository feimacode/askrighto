import type { BenchState } from "./types.js";

/**
 * Australia Post postcode ranges. Border postcodes can straddle states (for example parts of 2620 and 4380);
 * the range's main state is used. 2618 (Hall ACT, Murrumbateman NSW) is treated as NSW, because the AER postcode sheet
 * maps it only to a zone that has NSW rows.
 * Returns "WA", "NT" or undefined for places outside the benchmark data.
 */
export function stateOfPostcode(postcode: string): BenchState | "WA" | "NT" | undefined {
  const n = Number(postcode);
  if (!/^\d{4}$/.test(postcode)) return undefined;
  if ((n >= 200 && n <= 299) || (n >= 2600 && n <= 2617) || (n >= 2900 && n <= 2920)) return "ACT";
  if ((n >= 800 && n <= 999)) return "NT";
  if ((n >= 1000 && n <= 2599) || (n >= 2618 && n <= 2899) || (n >= 2921 && n <= 2999)) return "NSW";
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return "VIC";
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  return undefined;
}
