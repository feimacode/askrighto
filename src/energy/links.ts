/**
 * Links from a plan result to where its rate sheet can be read. Built when a result is formed;
 * nothing is stored, fetched or read from those pages (AGENTS.md rule 2: links, not scraping).
 *
 * - Plan ids ending `@EME` (national CDR data): the Energy Made Easy page for the offer, which holds
 *   the rate sheet. Needs the postcode the person gave.
 * - Plan ids ending `@VEC` (Victoria): there is no unified rate sheet page, so only the retailer's
 *   own website, labelled as such. A brand with no hand-checked website gets no link, not a guess.
 * - A link the retailer published itself is used first.
 */
import { RETAILERS } from "./index.js";

export interface PlanLink {
  url?: string;
  /** What the link is, in words the host can repeat. Never "plan page" unless it is the offer's page. */
  label: string;
  /** Extra sentence for the person, for example where to find the rate sheet. */
  note?: string;
}

export const EME_RATE_SHEET_LABEL = "Rate sheet on Energy Made Easy";
export const RETAILER_SITE_LABEL = "Retailer website";
export const RETAILER_SITE_NOTE = "Victoria has no single rate sheet page: find this plan's rate sheet on the retailer's website.";

const EME_PLAN = "https://www.energymadeeasy.gov.au/plan";

export interface PlanLinkInput {
  planId: string;
  brandName: string;
  /** The postcode the person gave, if any. */
  postcode?: string;
  /** A link the retailer published. */
  publishedUrl?: string;
}

/** Hand-checked website for a brand, by name; undefined when none is held. */
export function websiteFor(brandName: string): string | undefined {
  const r = RETAILERS.find((x) => x.brandName === brandName && x.website);
  return r?.website;
}

export function planLink(i: PlanLinkInput, website: string | undefined = websiteFor(i.brandName)): PlanLink {
  if (i.publishedUrl) return { url: i.publishedUrl, label: "Link published by the retailer" };
  const at = i.planId.lastIndexOf("@");
  const suffix = at >= 0 ? i.planId.slice(at + 1) : "";
  const offerId = at >= 0 ? i.planId.slice(0, at) : i.planId;
  if (suffix === "EME") {
    if (!/^\d{4}$/.test(i.postcode ?? "")) return { label: EME_RATE_SHEET_LABEL, note: "No link: it needs the postcode of the property." };
    return { url: `${EME_PLAN}?id=${encodeURIComponent(offerId)}&postcode=${i.postcode}`, label: EME_RATE_SHEET_LABEL };
  }
  if (suffix === "VEC") {
    if (!website) return { label: RETAILER_SITE_LABEL, note: "No link is available for this plan." };
    return { url: website, label: RETAILER_SITE_LABEL, note: RETAILER_SITE_NOTE };
  }
  return { label: "No link", note: "No link is available for this plan." };
}

/** Markdown for a table cell or line: a labelled link, or the plain statement that none exists. */
export function linkMarkdown(l: PlanLink): string {
  return l.url ? `[${l.label}](${l.url})` : "no link available";
}
