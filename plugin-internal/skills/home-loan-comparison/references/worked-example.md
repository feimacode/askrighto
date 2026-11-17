# Worked example (invented lender and figures, for the shape of an answer only)

User: "What are some owner-occupier variable rates for an 80 percent LVR, and what would repayments be on a $500,000 loan over 30 years?"

Good answer, in outline:

1. Calls `search_home_loans` with owner-occupier, variable and LVR 80, then reads out the lowest published rates the result lists, each with its lender link and as-of date. It says these are the lowest published rates for the filters given, not a recommendation, and states the coverage line.
2. Calls `calculate_home_loan_repayments` for one product the user picks, with the user's amount and term, and reports the repayment, total interest and the "not modelled" list exactly as returned, calling it arithmetic on the rate shown.
3. Passes on the notice that published rates may differ from what a lender offers.

If the user then asks "so which one should I take?", it uses the fixed suitability refusal from `rules.md` and offers a side-by-side with `compare_home_loans`.
