/** Fixed wording for health cover results. */
export const HEALTH_NOTICE =
  "Ask Righto is a free information tool. It compares published facts, takes no commission and is not an insurer, broker or adviser. Prices and cover come from the Private Health Insurance Ombudsman's monthly file and can differ from the insurer's own: confirm price and cover with the insurer before acting.";

/** Short form for component captions, which are length limited. */
export const HEALTH_CAPTION =
  "Free information tool: no commission, not an insurer, broker or adviser. Confirm price and cover with the insurer.";

export const CALCULATED_NOTE =
  "calculated by Ask Righto from the published premium and the ATO rates effective on the date shown; your insurer's quote and the ATO's own calculator govern";

export const PHIO_SOURCE = {
  name: "PrivateHealth.gov.au product data, Private Health Insurance Ombudsman",
  url: "https://data.gov.au/data/dataset/private-health-insurance",
  licence: "CC BY 3.0 AU",
} as const;

export const ATO_REBATE_URL =
  "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/private-health-insurance-rebate/income-thresholds-and-rates-for-the-private-health-insurance-rebate";

export const RULES_SOURCE = {
  name: "ATO rebate, Medicare levy surcharge and Lifetime Health Cover pages",
  url: ATO_REBATE_URL,
  licence: "Facts re-keyed with source links (reuse licence of the pages to be confirmed)",
} as const;

export const HEALTH_NO_ADVICE =
  "Ask Righto does not recommend a policy, say whether you should hold, buy, switch or cancel cover, or judge what cover a medical condition needs. For complaints about an insurer see the Commonwealth Ombudsman (private health insurance).";

/** Words health results and guidance never use to steer a decision. */
export const HEALTH_BANNED: readonly RegExp[] = [
  /\bbest\b/i,
  /right for you/i,
  /\bshould\b/i,
  /\brecommend/i,
  /worth it/i,
  /you'?ll save/i,
  /cheapest overall/i,
];
export const bannedInHealth = (text: string): string[] =>
  HEALTH_BANNED.flatMap((re) => text.match(re)?.[0] ?? []);

/** The most recent 1 April or 1 July on or before `now` (UTC), as YYYY-MM-DD. */
export function lastPremiumChangeDate(now = new Date()): string {
  const y = now.getUTCFullYear();
  const cands = [`${y}-07-01`, `${y}-04-01`, `${y - 1}-07-01`];
  const today = now.toISOString().slice(0, 10);
  return cands.find((c) => c <= today)!;
}

/** A warning when the loaded file is dated before the latest 1 April or 1 July, when premiums and rates usually change. */
export function premiumChangeWarning(fileDate: Date, now = new Date()): string[] {
  const last = lastPremiumChangeDate(now);
  return fileDate.toISOString().slice(0, 10) < last
    ? [`The loaded product file is dated ${fileDate.toISOString().slice(0, 10)}, before ${last}, when premiums often change. Prices may be out of date; confirm with the insurer.`]
    : [];
}
