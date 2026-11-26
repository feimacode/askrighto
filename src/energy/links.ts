/**
 * Plan links, built when a result is formed. Nothing is fetched, read or stored from the pages they point to.
 * Rules (add-energy-plan-links, from Iven, 18 Nov 2026):
 *  - a plan link the retailer published is used first;
 *  - outside Victoria (id ends @EME) the Energy Made Easy page for the offer at the person's postcode, which holds the rate sheet;
 *  - Victoria (id ends @VEC, or the postcode is Victorian) has no unified rate sheet page, so the retailer's own website;
 *  - no link when none can be built, with the reason, never the plan id as a link.
 * The offer id is the stored id without its `@EME` suffix and its trailing revision digits (stored `ENG1207222MRE2@EME` is
 * offer `ENG1207222MRE`; every `@EME` id in the 17 Nov 2026 load ends in 1 or 2 revision digits).
 */
import retailersJson from "./retailers.json" with { type: "json" };
import { stateOfPostcode } from "./benchmarks/state.js";

export type LinkKind = "retailer_plan_page" | "eme_rate_sheet" | "retailer_website" | "none";

export interface PlanLink {
  kind: LinkKind;
  /** Absent when kind is "none". */
  url?: string;
  /** What the link is, in the words shown to people. */
  label: string;
  /** What the person should do or know; always present. */
  note: string;
}

export interface LinkRetailer {
  slug: string;
  website?: string;
  websiteCheckedAt?: string;
  noWebsite?: string;
  brandWebsites?: Record<string, string>;
}

export interface LinkPlan {
  planId: string;
  retailerSlug: string;
  brandName: string;
  /** A link the retailer published in the plan record (usually absent). */
  planUrl?: string;
}

export const EME_ORIGIN = "https://www.energymadeeasy.gov.au";
export const LINK_NOTICE =
  "Links go to Energy Made Easy or the retailer's own website. Ask Righto does not read or store those pages: check the rate sheet there before you decide.";

const RETAILERS = retailersJson as LinkRetailer[];

/** `ENG1207222MRE2@EME` becomes `ENG1207222MRE`; undefined when the id is not an @EME id of that shape. */
export function emeOfferId(planId: string): string | undefined {
  return /^([A-Za-z0-9]*[A-Za-z])\d+@EME$/.exec(planId)?.[1];
}

export function retailerWebsite(plan: Pick<LinkPlan, "retailerSlug" | "brandName">, retailers: readonly LinkRetailer[] = RETAILERS): string | undefined {
  const r = retailers.find((x) => x.slug === plan.retailerSlug);
  return r?.brandWebsites?.[plan.brandName] ?? r?.website;
}

const none = (note: string): PlanLink => ({ kind: "none", label: "No link available", note });

export function planLink(plan: LinkPlan, postcode?: string, retailers: readonly LinkRetailer[] = RETAILERS): PlanLink {
  if (plan.planUrl) {
    return { kind: "retailer_plan_page", url: plan.planUrl, label: "Plan page published by the retailer", note: "Link published by the retailer in the plan record." };
  }
  const pc = postcode && /^\d{4}$/.test(postcode.trim()) ? postcode.trim() : undefined;
  const offer = emeOfferId(plan.planId);
  const victorian = plan.planId.endsWith("@VEC") || (pc !== undefined && stateOfPostcode(pc) === "VIC");
  if (offer && !victorian) {
    if (!pc) return none("Give the postcode of the property to get the Energy Made Easy rate sheet link for this plan.");
    return {
      kind: "eme_rate_sheet",
      url: `${EME_ORIGIN}/plan?id=${encodeURIComponent(offer)}&postcode=${pc}`,
      label: "Rate sheet on Energy Made Easy",
      note: `Energy Made Easy (AER) page for this offer at postcode ${pc}.`,
    };
  }
  const site = retailerWebsite(plan, retailers);
  if (!site) return none(`No checked website is on file for ${plan.brandName}, so no link can be given. Look the retailer up directly.`);
  const why = plan.planId.endsWith("@VEC") || victorian ? "Victoria has no single rate sheet page" : "No plan-level link could be built for this plan";
  return {
    kind: "retailer_website",
    url: site,
    label: "Retailer website",
    note: `${why}. This is the retailer's home page, not the plan's page: find this plan's rate sheet there.`,
  };
}

/** One line for markdown: a link with its label, or the reason there is none. */
export function linkMarkdown(l: PlanLink): string {
  return l.url ? `[${l.label}](${l.url})` : `${l.label} (${l.note})`;
}

/** Short cell text for tables. */
export function linkCell(l: PlanLink): string {
  return l.url ? `[${l.label}](${l.url})` : "No link available";
}

/** Footer lines for a text result that shows links: the standing notice plus one line for each kind shown that needs explaining. */
export function linkNotes(links: readonly PlanLink[]): string[] {
  const out = [LINK_NOTICE];
  if (links.some((l) => l.kind === "retailer_website")) {
    out.push("Retailer website links go to the retailer's home page, not the plan's page. Victoria has no single rate sheet page, so find this plan's rate sheet on the retailer's site.");
  }
  if (links.some((l) => l.kind === "none")) {
    out.push("Where no link is available the plan id is shown as text only. Give the postcode of the property for an Energy Made Easy link, or look the retailer up directly.");
  }
  return out;
}
