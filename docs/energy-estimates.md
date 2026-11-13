# Energy cost estimates

`compare_energy_plans` estimates a yearly cost for each plan from the plan's published rates and
the usage the user gives. The calculation is `src/energy/calc.ts`, a pure function: the same plan
and usage always give the same result. Nothing is guessed; what cannot be estimated is listed
with a reason.

## Types

- `Usage`: fuel, yearly kWh or MJ, optional peak/shoulder/off-peak shares (sum 100), yearly
  controlled load kWh, yearly solar export kWh.
- `Estimate`: total in cents, a `Breakdown` (supply, usage, controlled load, solar credit,
  guaranteed discounts, fees, GST) that sums exactly to the total, conditional discounts with
  their conditions, the total if they are met, `notIncluded`, `notes` and eligibility `restrictions`.
- `NotEstimated`: plan reference, a reason and a one-line detail. Reasons: `demand_tariff`,
  `needs_time_of_use_split`, `not_fully_understood`, `no_controlled_load_rate`, `gst_basis_unknown`,
  `missing_rate`.

## How it is calculated

1. Supply: daily supply charge times the days in each tariff period (a year is 365 days).
2. Usage: yearly usage is spread evenly by day, so a seasonal period gets usage in proportion to
   its days. Block rates apply their threshold per the block's stated period (day, month, quarter,
   year) to that even usage.
3. Time of use: needs the shares from the bill. A plan with no shoulder rate has the shoulder
   share charged at peak. Without shares those plans are `needs_time_of_use_split`.
4. Controlled load: usage times its rate plus its daily supply charge, only when controlled load
   usage is given. A plan without one is `no_controlled_load_rate`.
5. Solar: export times the feed-in rate, shown as its own negative line, without GST.
6. Discounts: guaranteed percentage discounts apply (percent of bill or of usage). Conditional
   ones (pay on time, direct debit and so on) are *not* in the ordering cost; each is listed with
   its condition, and `totalIfConditionsMet` shows the lower cost. Fixed-amount discounts and
   other forms whose basis is unclear are listed under `notIncluded`, not applied.
7. Fees: recurring membership-type fees only. One-off fees are listed as left out.
8. GST: 10% of the taxable components when the published amounts exclude it; none to add when they
   include it. **If the GST basis is `UNKNOWN` no plan is estimated** (`gst_basis_unknown`).

Components are rounded once to the cent each, and the total is their sum, so the breakdown always
adds up.

## Ordering and wording

Estimated plans are ordered by cost without conditional discounts, ties broken by retailer name
then plan id. Nothing is labelled best or recommended; the summary says "the lowest estimate for
the usage given". Every found energy result carries the standard notice in `src/tools/energy-common.ts`.

## Left out

One-off fees, sign-up credits, concessions and rebates, green power charges, demand tariffs,
plans with several controlled load or feed-in tariffs, time-varying feed-in tariffs and block
time-of-use rates. Eligibility restrictions are shown but not checked.

## Open checks

Percentage discount rates are read as fractions (0.05 is 5%) and fixed-amount discounts are not
applied; both must be confirmed against recorded fixtures. Three plans still need comparing with the
retailers' own published estimates (task 1.7 of `add-energy-plan-tools`). Until the GST basis is
confirmed from recorded fixtures (`docs/energy-data.md`), the live server estimates nothing.

## Example prompts

Each maps to a call in `test/energy/tools.test.ts`.

- "What energy plans are available at 3000?" → `search_energy_plans`
- "Show me the details of plan A1." → `get_energy_plan`
- "Compare electricity plans at 3000 on CitiPower; I used 1,000 kWh over 90 days." → `compare_energy_plans`
- "Same, but I'm on Jemena with a 30/20/50 peak, shoulder and off-peak split and export 500 kWh of solar." → `compare_energy_plans` with a split
- "Which should I pick?" → the host answers with the lowest estimate and the notice, never "best"
