# Tasks

## 1. Verify

- [ ] 1.1 Re-read the AEMO MDFF specification (NEM12 and NEM13, v2.7 or newer) and record the record layouts, quality and method flags, unit and interval-length rules, and the specification's page link, in `docs/energy-interval-readings.md`; verify against Iven's file that the `200`, `300` and `400` layouts match
  - Partly done: record layouts checked against the MDFF v2.7 PDF Iven supplied and against his real file (200, 300 and 400 layouts match, 100 and 900 absent). The spec's page link was not confirmed, so the tool's source URL is AEMO's home page until a person supplies it.
- [x] 1.2 Check the current AEMO National Metering Identifier Procedure (the copy supplied is V5.1, August 2009, section 7, Table 1) for the data stream suffix rules and record the version and link in the docs; ask Iven for a file from a household with solar (a `B` stream) and, if possible, a full MDP-style file with `100` and `900` records; verify the mapping in design decision 6 (all `E` main consumption, all `B` solar export, controlled load a gap) against them
  - Done: Iven confirmed (19 Nov 2026) that the 2009 edition of the National Metering Identifier Procedure still applies with no change; mapping is all E streams main consumption, all B streams solar, controlled load a gap. No solar file yet: the B stream is tested on synthetic files only.
- [ ] 1.3 Test how each host (Claude, ChatGPT, Gemini, or the MCP Inspector) passes a 100 KB tool argument and record the largest that works; set the size cap from it
  - Not done: needs the three hosts or the MCP Inspector. The cap stays at 600,000 characters, and the profile string is about 8 KB.
- [x] 1.4 Check the daylight saving rules for NSW, VIC, ACT, TAS, QLD and SA and record the market-time to local-clock conversion; verify with the window test cases
  - Done: market-time to local-clock conversion by state, in `src/energy/readings/profile.ts`. Daylight saving runs the first Sunday of October to the first Sunday of April for NSW, VIC, ACT, TAS and SA (SA is a half hour behind or ahead of the others), none for QLD; the change-over day uses the new offset for the whole day (a small error on two days a year).

## 2. Build

- [x] 2.1 Build the synthetic NEM12 fixture (all record shapes seen: no `100`/`900`, short last line, `V` day with `400` events, a missing day, 5, 15 and 30 minute intervals, `E1`, `E2`, `B1`, `B2` and a net `N1` file) under `test/fixtures/readings/`; verify it never contains a real NMI
  - Done: synthetic files are generated in `test/energy/readings-upload.test.ts` (header and no header, short last line, V day with 400 events, missing day, 5/15/30 minute intervals, E1, E2, B1, B2, N1). Invented NMI and serial; the test checks neither appears in any result.
- [x] 2.2 Write the parser (`src/energy/readings/parse.ts`) and the profile encoder with version, ranges and size cap; verify unit tests for each parser and refusal scenario in the spec
  - Done: `src/energy/readings/parse.ts` and `profile.ts` (version 1 profile string, about 8 KB, revalidated with a totals check).
- [x] 2.3 Add `summarise_interval_readings` (flat input, read-only hints, verb-first name); verify it logs nothing from the input and returns no identifier (test greps the result and the logs)
  - Done: `summarise_interval_readings` (flat input; read-only hints). It takes the postcode as well as the text, so the profile is built on the household's local clock (a change from the design, see design.md). The verb `summarise` was added to the allowed tool verbs.
- [x] 2.4 Add window-share maths with daylight saving per state (`src/energy/readings/windows.ts`); verify tests with a synthetic profile that has a known peak across a daylight saving change for each state
  - Done: `src/energy/readings/windows.ts`: weekday and weekend windows, 20:59 and 21:00 end styles, overnight windows, a residual off-peak, seasonal tariff periods by month; plans with gaps, overlaps, odd times, partial weekdays or several shoulders are listed as not estimated.
- [x] 2.5 Add `readingsProfile` and the `readings` basis to `compare_energy_plans` (markdown and Inkview); verify tests for each scenario in the energy-plan-comparison delta, including a time-of-use plan estimated from the profile and an unmappable plan listed as not estimated
  - Done: `readingsProfile` and the `readings` basis in `compare_energy_plans` (`Usage.sharesFor` per tariff period in `calc.ts`; the maths is unchanged). Tests cover each scenario in the delta, and a time-of-use plan costs the same from the readings as from a bill split with the same shares.
- [x] 2.6 Update the tool descriptions, server instructions and energy bill skill; verify the smoke test finds the guidance and that it never asks for the file to be sent anywhere
  - Done: tool description, server instructions and energy skill; the wording from #45 that said Ask Righto cannot read the file is updated.
- [x] 2.7 Write `docs/energy-interval-readings.md` and update `docs/areas/energy-plans.md`
  - Done: `docs/energy-interval-readings.md` and `docs/areas/energy-plans.md`.

## 3. Before shipping

- [x] 3.1 Run Iven's real file through the tool on a developer machine and check the totals and the time-of-day split against an independent calculation; record the match, not the file
  - Done on a developer machine with Iven's real file (not stored or committed): period 2025-11-18 to 2026-11-17, 364 days, one missing (2026-02-17), total 2,665.221 kWh, annual 2,673 kWh, and the share of use in a weekday 15:00-21:00 peak, 07:00-15:00 shoulder and off-peak (local clock, daylight saving) of 27.37%, 36.78% and 35.86% matches an independent Python calculation to four decimals. This checks the code, not the daylight saving convention, which both used.
- [ ] 3.2 Check the AEMO specification link and version still hold
- [ ] 3.3 Run the three hosts or the Inspector end to end with the real file, confirm no identifier appears in any result or log, and confirm the size limit holds
