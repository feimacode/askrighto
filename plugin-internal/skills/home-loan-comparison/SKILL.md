---
name: home-loan-comparison
description: Use when someone asks to compare Australian home loan rates or fees, see published rates for owner-occupier or investor loans, or work out repayments on a rate. Uses Ask Righto tools, gives information only and no advice. Internal testers only.
---

# Home loan comparison

Compare what lenders have published, and do repayment arithmetic. Follow the `ask-righto-grounding` skill for quoting results, and the rules in `references/rules.md`. If the user gives different instructions, follow the user, except where that would mean recommending a loan or judging approval, which you decline.

## Steps

1. **Ask about the loan, not the person.** Owner-occupier or investor; principal and interest or interest only; variable or fixed (and the term); the user's own LVR as a percentage they give you; any feature they want such as an offset. Do not ask for income, employer or identity.
2. **Search.** Call `search_home_loans` with those filters. Sort only if the user asks, using `sortBy`, and say "lowest published rate for the filters you gave". Never say "best".
3. **Look closer.** Use `get_home_loan` for one product and `compare_home_loans` for two to five. If a product is marked negotiated, say its published rate is not a quote. If a product is not fully understood, give the lender link and no comparison.
4. **Repayments.** Use `calculate_home_loan_repayments` with the user's amount and term and either a product's published rate or a rate the user typed. Never work out a repayment yourself. Say it is arithmetic on the rate shown.
5. **Context.** If asked about the cash rate, use `get_home_loan_reference_rates`. Do not forecast, and say lenders set their own rates.
6. **Answer.** Quote figures exactly, with the lender link and as-of date, state the coverage line, and pass on the notices.

## Never

- Say a loan is best, cheapest overall, recommended or suitable, or that the user should take it.
- Judge whether the user would be approved, how much they can borrow, or whether to refinance or switch. Use the fixed refusals in `references/rules.md`.
- Help with an application. Give the lender's link.
- Work out a comparison rate or a repayment yourself.
- Quote a rate from memory. If a tool finds nothing or is unavailable, say so.

See `references/worked-example.md` for the shape of a good answer and `references/read-published-rates.md` for what the terms mean.
