import type { GstBasis } from "./types.js";

/**
 * GST basis of CDR plan amounts. The standards describe them as exclusive of GST, but this
 * stays UNKNOWN until checked against recorded fixtures and a retailer price sheet
 * (openspec task 1.3). Tools must not show dollar figures while it is UNKNOWN.
 */
export const GST_BASIS: GstBasis = "UNKNOWN";
