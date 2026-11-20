## Context

`Usage.shares` is `{ peak, shoulder, offPeak }`. In `touCharge`, a plan with no shoulder band charges the shoulder share at the peak rate, and a plan with one or more shoulder bands splits the shoulder share equally between them. `windows.ts` (`bandShares`) refuses more than one shoulder band. Counts, 17 Nov 2026: 6,501 current electricity plans have a time-of-use tariff; 4,268 can be mapped by the matcher; the other 2,233 are refused only because of several shoulder bands.

## Decisions

1. **Shares by band type.** `Usage.shares` becomes `Record<string, number>` keyed by the plan's own band types (`PEAK`, `OFF_PEAK`, `SHOULDER`, `SHOULDER1`, ...) with a helper that builds it from a bill's three numbers for a given plan (peak to `PEAK`, off-peak to `OFF_PEAK`, shoulder split equally across that plan's shoulder bands, or to `PEAK` if it has none, as today). The sum is 100 per cent, checked.
2. **Readings give each band exactly.** `bandShares` returns shares keyed by band type. With one shoulder band the result equals today's. With several, each gets its own share from the half-hourly sums.
3. **Say the assumption.** A bill split on a plan with several shoulder bands is estimated with the equal split and the estimate lists "the shoulder share was split equally between N shoulder bands" in its notes. Nothing is hidden.
4. **Profile unchanged.** Per-slot sums carry any layout, so version 1 stays.
5. **Seasonal tariff periods** already take their own shares from the months the period covers; unchanged.

## Risks / Trade-offs

- A shape change in `Usage` touches the calc tests; the maths for single-shoulder plans must come out identical (a regression test compares costs before and after on the fixtures and the 17 Nov plans).
- Plans with unusual band names are still listed as not estimated, with the reason.

## Open Questions

- Do retailers publish shoulder bands with different rates (SHOULDER1 and SHOULDER2 differ)? Yes in the data; the equal split is only a bill-route assumption and is stated.
