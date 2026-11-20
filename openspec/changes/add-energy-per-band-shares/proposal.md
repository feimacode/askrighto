# Proposal

## Why

Time-of-use plans can have more than one shoulder band (`SHOULDER1`, `SHOULDER2`). In the 17 Nov 2026 data that is **2,233 of the 6,501 current electricity plans with a time-of-use tariff (34 per cent)**. Today `calc.ts` takes one shoulder share and splits it **equally** between shoulder bands, and the readings window matcher refuses such plans ("several shoulder bands"), so those plans cannot be costed from interval readings at all and are costed from a bill split only on an assumption nobody told the user about.

## What Changes

- Carry usage shares **per band**, not as three fixed fields: a map from each of the plan's own band types to a percentage. A bill still gives peak, shoulder and off-peak; readings give every band exactly.
- Readings: the window matcher returns a share for each shoulder band, so plans with several shoulder bands are estimated from readings.
- Bill split: when a plan has several shoulder bands, the one shoulder percentage is shared equally between them and **the result says so** (an assumption, listed beside that plan), where today it is silent.
- No change to the profile string (it holds half-hourly sums, so any band layout can be read from it) and no change to how a single-shoulder plan is costed.

Data source: none new. Same plan data and the same profile. Hosts affected: Claude, ChatGPT and Gemini through `compare_energy_plans`; no new inputs.

Out of scope:

- Different shares for seasonal tariff periods from a bill (a bill covers one period).
- Demand charges, controlled load time bands and any change to how rates are read.
- Public holidays (treated as ordinary days, as now).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-comparison`: shares are per band, and plans with several shoulder bands can be estimated from readings.

## Impact

- Changed: `src/energy/calc.ts` (shares type and the time-of-use charge), `src/energy/readings/windows.ts`, `src/tools/compare-energy-plans.ts` (wording), tests, `docs/energy-estimates.md`, `docs/energy-interval-readings.md`.
- No migration, no data change, no new tool. Depends on `add-energy-readings-upload` (merged).
