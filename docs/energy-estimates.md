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
   share charged at peak. A plan with several shoulder bands (SHOULDER1, SHOULDER2) gets the bill's one
   shoulder figure split equally between them, and the estimate says so in its notes; readings give
   each band its own share. Without shares those plans are `needs_time_of_use_split`. With a bill split, only plans with the same band hours as the household's current plan (`currentPlanId` or `hoursLayoutId`) are estimated exactly; other time-of-use plans are labelled approximate and listed apart (see `docs/energy-invoice.md`).
4. Controlled load: usage times its rate plus its daily supply charge, only when controlled load
   usage is given. A plan without one is `no_controlled_load_rate`.
5. Solar: export times the feed-in rate, shown as its own negative line, without GST.
6. Discounts: guaranteed percentage discounts apply (percent of bill or of usage). Conditional
   ones (pay on time, direct debit and so on) are *not* in the ordering cost; each is listed with
   its condition, and `totalIfConditionsMet` shows the lower cost. `compare_energy_plans` returns
   these plans again in `ifConditionsMet`, a separate table ordered by the cost if every listed
   condition is met, with each plan's place in the main ordering and its conditions. Fixed-amount discounts and
   other forms whose basis is unclear are listed under `notIncluded`, not applied.
7. Fees: recurring membership-type fees only, as published (fees are published including GST).
   One-off fees are listed as left out.
8. GST: 10% of supply, usage, controlled load and guaranteed discounts when the published amounts
   exclude it (the case since 16 Nov 2026, see `docs/cdr-schemas.md`); fees and the solar credit
   are outside it. **If the GST basis is `UNKNOWN` no plan is estimated** (`gst_basis_unknown`).
9. Time-of-use plans whose bands cannot be told apart by name (AGL labels both bands `SHOULDER`)
   are not estimated yet (`not_fully_understood`).

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

## Typical usage (benchmark)

`Usage.basis` is `"customer"` (a bill or stated figure) or `"benchmark"` (the AER typical
household figure, only when the person has no usage and asks for it with `useBenchmarkUsage` and
`householdSize`). The maths is the same either way; only the label differs. With a benchmark,
time-of-use plans are `needs_time_of_use_split` (no split exists), controlled load and solar export
are not computed, and the typical-usage notice leads every output form. Details, data and limits:
[`energy-benchmarks.md`](energy-benchmarks.md).

## Time-of-use plans by shoulder bands (counted 20 Nov 2026 on the 17 Nov 2026 data)

Residential electricity plans stored: 10,552. With a time-of-use tariff: 6,501. By the most shoulder bands a plan has in any tariff period:

| Shoulder bands | Plans |
| --- | --- |
| 0 | 1,026 |
| 1 | 3,242 |
| 2 | 792 |
| 3 | 1,136 |
| 4 | 305 |

So 2,233 plans (34.3% of time-of-use plans) have several shoulder bands, as the proposal said. Nearly all of them (1,924, 29.6%) have **no PEAK or OFF_PEAK band at all**: every band is labelled `SHOULDER` (the AGL style), so the bands cannot be told apart by name. Only 309 of the 2,233 have PEAK and OFF_PEAK plus numbered shoulders, and those are the ones this change made estimable.

Effect of the per-band change (same data, the same synthetic year of readings and three bill splits):

- **Regression**: for the 4,268 plans with at most one shoulder band, the estimate (or the reason it is not estimated) is identical before and after the change for all three splits (30/20/50, 10/0/90, 45/15/40).
- **Readings**: plans whose windows map onto a year of half-hourly readings rose from 4,268 (65.7%) to 4,577 (70.4%), not to the 100% a name-based count would suggest.
- **Bill split**: 2,925 plans are estimated with a split before and after; the new multi-shoulder plans with PEAK and OFF_PEAK added no more because the other refusals (blocks in a band, demand tariffs) apply to them too.
- **Still refused for a bill split**: 1,924 plans (bands not in the expected shape: no PEAK or OFF_PEAK, or the same type twice), 219 with block rates inside a band, 8 with demand charges. For readings the same all-`SHOULDER` plans are refused because two bands share one type.

Method: the stored `plans` table of the local copy of the 17 Nov 2026 sync (read-only), the pre-change calculator against the current one, residential plans only.
