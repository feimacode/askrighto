## Context

The energy tools estimate a yearly bill from user-supplied usage and rank by lowest estimate. Home loans are riskier: a "lowest rate" list reads as a suggestion to take a loan, and the regulatory line is the one in `docs/home-loans-research.md` section 2 (unverified in its legal detail). The design therefore separates three kinds of output:

1. **Published facts** (rates, fees, features), shown as the lender published them.
2. **Calculations** from the user's own numbers and a published rate, produced by code with the formula and assumptions shown.
3. **Narration** by the host, which the skill and instructions constrain.

## Decisions

1. **No score, no "best", no default sort that implies advice.** `search_home_loans` sorts only by a field the user asked for (`sortBy`: `published_rate`, `published_comparison_rate`, `ongoing_fees`); with no `sortBy` it returns lender-alphabetical order and says so. The response states the sort and that cheaper on one measure is not better overall. ASIC's 2012 warning on unexplained rankings and price-only comparisons is the reason (research doc section 2).
2. **Search input.** `purpose`, `repayment`, `rateType`, `fixedTermYears`, `lvrPercent` (the user's own LVR figure, used only to pick matching LVR tiers), `feature` (OFFSET, REDRAW, EXTRA_REPAYMENTS), `lender`, `sortBy`, `limit` (capped at 25). No income, employment or personal data fields exist.
3. **Which rate is shown.** A product has several rates. For a search, each product row shows the rate that matches the filters (purpose, repayment, rate type, LVR tier) or `no matching published rate`. If the LVR tiers do not cover the figure given, the product is listed under "no published rate for this LVR", not silently dropped, so the list is honest about coverage. `isTailored` products are labelled "rate is negotiated; published figure is not a quote".
4. **Comparison rate.** Shown only if the lender published it, in its own field, labelled "as published by the lender", with the fixed notice that a comparison rate is true only for the example the lender used and excludes some costs. We never compute our own. The wording of that notice waits for the legal view (**unverified**: the exact statutory warning text and example amounts); until then the tool says only what the data says and links to the lender.
5. **Repayment calculator.**
   - Formula: standard amortisation, `payment = P * r / (1 - (1 + r)^-n)` for monthly (or fortnightly and weekly using the period rate); interest-only payment `P * r`. Computed in integer cents with a stated rounding rule, with golden tests against published worked examples (source to find; **unverified**).
   - Rate source: either `lender` + `productId` + the matching published rate (shown with its link and as-of date), or `userRatePercent` supplied by the user, labelled "rate you entered", with no source claim. A product's introductory or fixed rate that expires is **not** modelled in the first release: the result says it covers the rate shown for the whole term, and for a fixed rate shorter than the term it reports only the fixed period (months and the balance at its end) and states that the rate after it is not assumed.
   - Offset: `avgOffsetBalance` reduces the balance interest accrues on, in a simple model (daily interest on balance minus offset, monthly). Output is labelled illustrative and states it assumes the offset is 100 percent against this loan. Only offered when the product publishes the `OFFSET` feature; otherwise `needs_input` explains.
   - Extra repayments: a fixed extra amount per period; output shows the new term and interest saved. Redraw is not modelled.
   - Fees: upfront and ongoing fees are shown beside the result as published and are not folded into the repayment. A "total cost over N years" figure is out (it would need assumptions about the fees the lender may not publish fully).
   - Every result lists inputs, formula name, rounding and what is not modelled.
6. **Reference rates tool.** Reads the stored RBA cash rate target; returns value, effective date, source URL, attribution. It states no forecast and no link to the loan rate (lenders set rates themselves).
7. **Not-found reasons** reuse the closed set: `not_in_dataset`, `outside_coverage`, `no_data_loaded`, `data_unavailable`, `needs_input`. A product that is `understood: false` is returned by `get_home_loan` with its raw published rates and a "not fully understood, check the lender page" notice; it is excluded from comparisons and calculations.
8. **Fixed notices** live in one module (`src/homeloans/notices.ts`) and are attached by the tool wrapper, not the model, so they cannot be dropped. Texts are drafts until the legal view approves them.
9. **Coverage disclosure.** Each search result states the number of lenders in the list, how many answered in the last 48 hours, how many products matched, and how many were excluded as not understood or not offered to new customers. Not all lenders in the market may be in the CDR; the tool says "lenders publishing through the Consumer Data Right", never "the market".
10. **Widgets.** Table and comparison through the Inkview SDK with a markdown fallback, matching the energy and course tools.
11. **Vertical wiring.** `home-loans` is added to `KNOWN_VERTICALS`; instructions text tells the host this vertical gives published product facts and arithmetic only, and lists the banned requests (suitability, approval, switching). With the flag unset it is absent from both routes.
12. **Counters.** Existing metadata-only counters; outcome per tool. No arguments are logged, so a loan amount cannot become a profile.

## Risks / Trade-offs

- **A calculator on a user's amount may be read as credit assistance.** Mitigation: internal-only until the legal view; outputs framed as arithmetic on the rate shown; question 2 of the research doc is a gate.
- **Headline rate vs offered rate.** Mitigation: tailored label, tier handling, accuracy spot check in the evaluation change.
- **Floating point in money.** Mitigation: integer cents, golden tests.
- **Host narration drifts into advice** ("this is your best option"). Mitigation: notices in tool output, instructions, the skill, and adversarial prompts in the evaluation change.

## Open Questions

- Should the calculator be shipped at all in the first public release, or only the listing and comparison tools? (Decide with the legal view; the code can ship dark.)
- Is the RBA cash rate worth a tool, or should it be a field in search results?
