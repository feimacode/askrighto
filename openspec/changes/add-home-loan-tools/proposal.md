## Why

With published home loan products stored (`add-home-loan-data`), a person comparing loans needs a host assistant that can filter products on their stated needs, show each lender's published rates and fees side by side, and run the repayment arithmetic they cannot easily do alone, with every figure traceable. The same tools must stay on the information side of the regulatory line: they list and compute from published figures and never say which loan to take.

## What Changes

- Add a `home-loans` vertical with five read-only tools:
  - `search_home_loans`: filter by purpose (owner-occupier or investor), repayment type, rate type (variable, fixed with a chosen term), LVR band, offset or redraw feature, lender; sort only by a user-chosen field (published rate, published comparison rate, annual ongoing fees).
  - `get_home_loan`: one product by lender and product id, with every published rate, tier, fee, feature, constraint and link.
  - `compare_home_loans`: two to five products side by side, optional Inkview comparison.
  - `calculate_home_loan_repayments`: deterministic repayment and total interest from a loan amount, term, a published rate taken from a stored product (or an explicitly user-supplied rate, labelled as such), repayment type and frequency; optional average offset balance to show interest saved; optional extra repayments. Labelled as a calculation from the rate shown, not an offer.
  - `get_home_loan_reference_rates`: the RBA cash rate target with date and attribution, plus a link to the RBA page.
- Every result carries the lender's source link, the verified-as-of date, and an explicit not-found; calculation results carry the inputs, the formula name and its assumptions.
- Results include fixed standard notices: published rates may differ from what a lender offers a person, comparison rates are true only for the lender's example, the list may not include every lender, and this is not credit advice.
- Visual results through Inkview (table, comparison), with a text fallback.
- Served only on the internal route until the promotion gates pass (`add-home-loan-promotion-gates`).
- Tool descriptions and instructions say what the tools do not do: no recommendation, no approval or borrowing power, no application, no switching or refinance advice.

## Capabilities

### New Capabilities

- `home-loan-tools`: the five tools, their inputs, outputs, wording limits and calculation rules.

### Modified Capabilities

None.

## Impact

- New `src/tools/home-loan-tools.ts`, `src/homeloans/calc.ts`, `src/homeloans/instructions.ts`, `src/homeloans/vertical.ts`; `KNOWN_VERTICALS` in `src/verticals.ts` gains `home-loans`; tools registered in `src/server/route.ts`.
- Depends on `add-home-loan-data` and `add-canary-release`. Public route unchanged.
- Hosts: all three. Claude lists lending as higher risk than energy, so the directory text for this vertical needs the legal view first (see promotion gates).

Out of scope: borrowing capacity or serviceability; pre-approval or application; refinance break-even and "should I switch" advice; stamp duty and first home buyer grants (separate roadmap item, stays off loans); lender ratings; broker or referral links; stored user inputs.
