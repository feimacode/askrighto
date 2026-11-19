# Tasks

## 1. Verify

- [ ] 1.1 Re-read the AEMO MDFF specification (NEM12 and NEM13, v2.7 or newer) and record the record layouts, quality and method flags, unit and interval-length rules, and the specification's page link, in `docs/energy-interval-readings.md`; verify against Iven's file that the `200`, `300` and `400` layouts match
- [ ] 1.2 Ask Iven for a second file from a household with solar or controlled load (registers `B1` and `E2`) and, if possible, a full MDP-style file with `100` and `900` records; verify the register mapping in design decision 6 against them
- [ ] 1.3 Test how each host (Claude, ChatGPT, Gemini, or the MCP Inspector) passes a 100 KB tool argument and record the largest that works; set the size cap from it
- [ ] 1.4 Check the daylight saving rules for NSW, VIC, ACT, TAS, QLD and SA and record the market-time to local-clock conversion; verify with the window test cases

## 2. Build

- [ ] 2.1 Build the synthetic NEM12 fixture (all record shapes seen: no `100`/`900`, short last line, `V` day with `400` events, a missing day, 5, 15 and 30 minute intervals, `E1`, `E2`, `B1`) under `test/fixtures/readings/`; verify it never contains a real NMI
- [ ] 2.2 Write the parser (`src/energy/readings/parse.ts`) and the profile encoder with version, ranges and size cap; verify unit tests for each parser and refusal scenario in the spec
- [ ] 2.3 Add `summarise_interval_readings` (flat input, read-only hints, verb-first name); verify it logs nothing from the input and returns no identifier (test greps the result and the logs)
- [ ] 2.4 Add window-share maths with daylight saving per state (`src/energy/readings/windows.ts`); verify tests with a synthetic profile that has a known peak across a daylight saving change for each state
- [ ] 2.5 Add `readingsProfile` and the `readings` basis to `compare_energy_plans` (markdown and Inkview); verify tests for each scenario in the energy-plan-comparison delta, including a time-of-use plan estimated from the profile and an unmappable plan listed as not estimated
- [ ] 2.6 Update the tool descriptions, server instructions and energy bill skill; verify the smoke test finds the guidance and that it never asks for the file to be sent anywhere
- [ ] 2.7 Write `docs/energy-interval-readings.md` and update `docs/areas/energy-plans.md`

## 3. Before shipping

- [ ] 3.1 Run Iven's real file through the tool on a developer machine and check the totals and the time-of-day split against an independent calculation; record the match, not the file
- [ ] 3.2 Check the AEMO specification link and version still hold
- [ ] 3.3 Run the three hosts or the Inspector end to end with the real file, confirm no identifier appears in any result or log, and confirm the size limit holds
