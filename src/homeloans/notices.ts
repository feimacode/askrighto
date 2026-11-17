/**
 * Fixed wording for home loan results. Attached by the tool wrapper, not the model, so it cannot be dropped.
 * DRAFT: every text here waits for the legal view (add-home-loan-promotion-gates).
 */
export const NOTICE_PUBLISHED =
  "Rates and fees are as each lender published them through the Consumer Data Right. They may differ from what a lender offers you: rates can depend on your circumstances, loan size and negotiation, and some products are tailored.";
export const NOTICE_COMPARISON_RATE =
  "A comparison rate, where a lender publishes one, is true only for the example the lender used and does not include every cost. Check the lender's own page.";
export const NOTICE_NOT_ADVICE =
  "This is general information, not credit advice or a recommendation. Ask Righto does not assess what suits you, whether you would be approved, or whether you should switch. Talk to the lender or a licensed broker about your own situation.";
export const COVERAGE_WORDS = "lenders publishing through the Consumer Data Right";

export const HOME_LOAN_NOTICE = [NOTICE_PUBLISHED, NOTICE_COMPARISON_RATE, NOTICE_NOT_ADVICE].join(" ");

export const CALC_NOTICE =
  "This is arithmetic on the rate shown, not an offer or a quote. It does not model rate changes, fees, redraw or the day-by-day way a lender charges interest, so a lender's figures will differ.";

export const BANK_SOURCE = {
  name: "Lenders' Consumer Data Right product reference data",
  url: "https://www.cdr.gov.au/",
  licence: "Consumer Data Right Rules (product data disclosed without conditions on use)",
} as const;

export const RBA_SOURCE = {
  name: "Reserve Bank of Australia",
  url: "https://www.rba.gov.au/statistics/cash-rate/",
  licence: "RBA terms for financial data (commercial use allowed, no RBA endorsement implied)",
  attribution: "Source: Reserve Bank of Australia 2026. The RBA does not endorse Ask Righto.",
} as const;
