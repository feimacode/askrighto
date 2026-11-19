# Tasks

## 1. Verify

- [x] 1.1 List the distributor names on active plans in the stored data and their spellings; verify the list covers every state in coverage
  - Done: 13 electricity distributors (15 spellings) and 27 gas distributor names on active plans (17 Nov load); electricity list is in `test/fixtures/energy/distributors-on-active-plans.json`. Covers NSW, ACT, VIC, QLD, SA and TAS; gas is out of scope.
- [ ] 1.2 On a machine that reaches the sites, find and check each distributor's own meter data request page (Ausgrid, Endeavour, Essential, Evoenergy, Jemena, CitiPower, Powercor, United Energy, AusNet, Energex, Ergon, SA Power Networks, TasNetworks, and any others found in 1.1); record `requestUrl`, `checkedAt` and what the page states about fees and time; list any with no page
  - Partly done: 3 of 13 pages checked and linked (Ausgrid, AusNet, SA Power Networks); the other 10 are listed with the reason (bot check, moved, no answer, no page) and the addresses to confirm by hand in `docs/energy-readings.md`.
- [x] 1.3 Check the biggest retailers' own pages for how to request readings; record only what they state
  - Done for what was reachable: EnergyAustralia and AGL pages read; Origin 404. Recorded in `docs/energy-readings.md`.
- [ ] 1.4 Re-read the current rule text (AEMC or AER) for the right to request data; confirm or correct the description, the data period and the free-request count, and record the rule numbers with the check date in `docs/energy-readings.md`
  - Not done: aemc.gov.au answered HTTP 403 to a plain request and I did not get around the bot check. The note avoids rule specifics; a person should confirm the current rule numbers, data period, free-request count and response time.

## 2. Build

- [x] 2.1 Add `src/energy/distributors.json` and a matcher by name and alias; verify unit tests for known, aliased and unmatched names
  - Done: `src/energy/distributors.json`, `src/energy/readings.ts` (matcher by name, alias, case and punctuation) and tests.
- [x] 2.2 Add the readings note to `compare_energy_plans` (markdown and Inkview) for benchmark and single-bill usage; verify tests for each spec scenario
  - Done: note in markdown (once, below the main table), structured data, and an Inkview `footnote` (the 300-character caption cap leaves no room). Electricity only; benchmark and single-bill usage only.
- [x] 2.3 Add the time-of-use line and the wording tests; verify they fail on an unsourced fee, time or handling claim
  - Done: time-of-use detail line (both usage bases) and `readingsWordingProblems`, with tests that fail on an unsourced fee, time or handling claim.
- [x] 2.4 Update the energy bill skill, server instructions and `docs/energy-readings.md`; verify the smoke test finds the guidance
  - Done: server instructions, energy bill skill, `docs/energy-readings.md`; tests find the guidance.
- [x] 2.5 Add the consistency test against distributors on active plans
  - Done: consistency test against the distributors on active plans (fixture list from the 17 Nov load); each entry needs a checked page or a reason.

## 3. Before shipping

- [ ] 3.1 Re-check every distributor link and the rule text still holds
- [ ] 3.2 Run a benchmark comparison for a postcode in each distributor's area and verify the right link appears
