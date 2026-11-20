## Context

Data check on the 17 Nov load: 6% of plans are uniquely identified by retailer, distributor and rates, and 25% by name, retailer and distributor, but 99% of groups with the same retailer, distributor and rates also have identical windows (1,548 of 1,564 time-of-use groups). There are 228 distinct band-hour layouts across 6,501 time-of-use plans; the top ten cover 45%. Per retailer and network the median is 2 layouts and the largest 9, so a pick list stays short. Bill rates may include GST and ours are stored exclusive.

## Decisions

1. **The user picks.** The tool never claims a unique match from a name. Options are grouped by identical rates and windows.
2. **Rates are shown for the user to recognise, not matched silently.** Display both with and without GST so the user can compare to the bill.
3. **Flat inputs:** retailer, postcode, distributor, customerType, fuelType, optional planName text to narrow the list. No bill figures required.
4. **Band hours in plain words**, from the stored windows, with the stored plan id returned for the comparison.
5. **Fallback shows layouts, not plans:** the layouts used by that retailer on that network, each with the number of plans using it.
6. **A bill split is exact only for plans with the same hours** as the user's current plan. The comparison tool takes an optional `currentPlanId` or `currentWindows`; plans with other hours are marked approximate.
7. **Bill figures are the user's own data,** quoted as read from the bill, not as Ask Righto facts.

## Risks

- A mistaken pick gives wrong windows; the options show rates and hours so the user can check.
- Legacy plans closed to new customers may be absent; the fallback covers them.
- Concessions and discounts on the bill are not modelled here.

## Open Questions

- Should the pick list show how recently the plan was updated?
