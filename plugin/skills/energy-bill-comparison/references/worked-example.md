# Worked example (invented inputs)

Everything here is made up to show the flow. None of it is a real plan, price or retailer.

**User:** Could I pay less for electricity? I'm in postcode 0000.

**Assistant:** (calls `search_energy_plans` with the postcode.) I can compare plans for that postcode. Two distributors serve it: which one is named on your bill? Also, from a recent bill, how many kWh did you use and over how many days?

**User:** The first one. 800 kWh over 90 days. No solar.

**Assistant:** (calls `compare_energy_plans`.) For 800 kWh over 90 days, these are the lowest estimates, cheapest first: [plans, each with estimated yearly cost, plan link, source and as-of date]. These are estimates for the usage you gave, not a recommendation. Some plans cost less if you meet a condition, shown separately: [the "If you meet the conditions" table from the result, with each plan's conditions]. Do you expect to pay on time or meet these conditions? [Notice from the result.] One plan is not estimated because [reason from the result]; here is its link.
