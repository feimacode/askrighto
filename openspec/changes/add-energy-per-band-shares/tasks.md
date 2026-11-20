# Tasks

## 1. Verify

- [ ] 1.1 Count again, on the data held at the time, the time-of-use plans by number of shoulder bands and record it in `docs/energy-estimates.md`; verify the 34 per cent figure
- [ ] 1.2 Record, from the 17 Nov plans, a regression set: for plans with at most one shoulder band, the cost from a bill split before the change; verify it is unchanged after

## 2. Build

- [x] 2.1 Change `Usage.shares` to per band with a bill-to-bands helper; verify unit tests for no, one and several shoulder bands
- [x] 2.2 Return per-band shares from `windows.ts` and accept several shoulder bands; verify tests, including a plan with SHOULDER1 and SHOULDER2
- [x] 2.3 State the equal-split assumption in the estimate's notes for the bill route; verify a test fails if it is missing
- [x] 2.4 Update `docs/energy-estimates.md` and `docs/energy-interval-readings.md` (remove "several shoulder bands" from the not-estimated reasons)

## 3. Before shipping

- [ ] 3.0 Check the CDR plan data licence and review-by date for `energy-plans` are still current
- [ ] 3.1 Check that the share of time-of-use plans that readings can estimate has risen from 66 per cent as expected, on the stored data
