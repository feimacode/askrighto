# Tasks

## 1. Verify

- [ ] 1.1 List the distributor names on active plans in the stored data and their spellings; verify the list covers every state in coverage
- [ ] 1.2 On a machine that reaches the sites, find and check each distributor's own meter data request page (Ausgrid, Endeavour, Essential, Evoenergy, Jemena, CitiPower, Powercor, United Energy, AusNet, Energex, Ergon, SA Power Networks, TasNetworks, and any others found in 1.1); record `requestUrl`, `checkedAt` and what the page states about fees and time; list any with no page
- [ ] 1.3 Check the biggest retailers' own pages for how to request readings; record only what they state
- [ ] 1.4 Re-read the current rule text (AEMC or AER) for the right to request data; confirm or correct the description, the data period and the free-request count, and record the rule numbers with the check date in `docs/energy-readings.md`

## 2. Build

- [ ] 2.1 Add `src/energy/distributors.json` and a matcher by name and alias; verify unit tests for known, aliased and unmatched names
- [ ] 2.2 Add the readings note to `compare_energy_plans` (markdown and Inkview) for benchmark and single-bill usage; verify tests for each spec scenario
- [ ] 2.3 Add the time-of-use line and the wording tests; verify they fail on an unsourced fee, time or handling claim
- [ ] 2.4 Update the energy bill skill, server instructions and `docs/energy-readings.md`; verify the smoke test finds the guidance
- [ ] 2.5 Add the consistency test against distributors on active plans

## 3. Before shipping

- [ ] 3.1 Re-check every distributor link and the rule text still holds
- [ ] 3.2 Run a benchmark comparison for a postcode in each distributor's area and verify the right link appears
