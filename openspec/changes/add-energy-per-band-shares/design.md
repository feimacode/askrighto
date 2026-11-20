## Context

`calc.ts` takes `peakSharePct`, `shoulderSharePct`, `offPeakSharePct` and divides the shoulder share equally between a plan's shoulder bands. `windows.ts` rejects a plan with several shoulders, so readings cannot be costed against it.

## Decisions

1. **Shares are keyed by band label** (PEAK, SHOULDER, SHOULDER1, SHOULDER2, OFF_PEAK), summing to 100.
2. **Readings:** the profile stores usage by a plan-independent time grid (weekday and weekend by half hour, per month). The matcher assigns each half hour to the plan's band by its own windows, so several shoulders are just more bands.
3. **Bill split with several shoulders:** a bill usually shows three bands. If the plan has more than one shoulder, the shoulder share is split equally and the plan is marked "approximate band split"; the wording says so.
4. **Order unchanged:** estimates are still ranked by lowest estimated cost; nothing is described as best.

## Risks

- Two shoulders may be wholly different times of day, so an equal split is only a fallback; readings are the exact route.
- Profile size is unchanged, since the grid is plan-independent.

## Open Questions

- Do any plans have bands beyond three kinds (for example a controlled-load time-of-use)? Survey the stored plans before building.
