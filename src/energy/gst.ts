import type { GstBasis } from "./types.js";

/**
 * GST basis of CDR plan rates and charges (usage rates, supply charges, controlled load,
 * demand charges). The standards describe them as exclusive of GST (CDS 1.35.0 field
 * descriptions, see docs/cdr-schemas.md), and this was confirmed on 16 Nov 2026 against a real
 * plan: AGL AGD812605MR@VEC publishes supply 0.9471, usage 0.278 and 0.1658, and its fact sheet
 * shows 104.18 c/day, 30.58 c/kWh and 18.24 c/kWh including GST (each x 1.1). Openspec task 1.3.
 *
 * Exceptions, handled where they are used: feed-in credits carry no GST for a household; fee
 * amounts are published including GST (AGL's fee descriptions say "Includes GST"; the standards
 * are silent), so they are shown and costed as published.
 *
 * Changing this needs `renormalise-energy` afterwards: the basis is stored with each contract.
 */
export const GST_BASIS: GstBasis = "EXCLUSIVE";
