# Tasks

## 1. Verify

- [ ] 1.1 Host test: can each host's sandbox read an attached CSV and reach an outside address, and where does the user allow a domain; record in `docs/energy-readings-host-test.md`
- [ ] 1.2 Read each directory's policy on code execution, tool output that instructs the model, and endpoints that receive user files; record what applies to a static recipe, a skill script and an upload address
- [ ] 1.3 Decide the layer 1 size threshold from the host test and record it

## 2. Build

- [x] 2.1 Description and instruction changes: say what to do for a long file, forbid your own windows, give the ladder; verify the instructions test
- [x] 2.2 Profile signing (`sign.ts`, key id, rotation) and the verified label in `compare_energy_plans`; verify tests for valid, edited, unsigned and wrong-key profiles
- [x] 2.3 (recipe written in `docs/energy-readings-recipe.md` and in the tool text; the static reference script and its test are not built yet) Write the recipe (`docs/energy-readings-recipe.md`), expose it in the tool text, and add the static reference script to the Claude skill; verify the script's output equals the server's on the synthetic files and that it has no network, shell, `eval` or file-writing calls
- [x] 2.4 Add `get_readings_upload_link` and the upload endpoint (signed token, size limit while reading, rate limit, no body logging, same origin only); verify tests for valid, expired, forged, oversize and unparsable uploads, and that nothing is stored
- [x] 2.5 Add evals and host test prompts for each layer and each failure; verify they run
- [ ] 2.6 Update `docs/energy-interval-readings.md` and `docs/deploying.md` (done for the key and ladder; the allowed-domains step for Claude web waits for the upload route)

## 3. Before shipping

- [ ] 3.0 Check the AEMO specifications the recipe cites (MDFF NEM12 and NEM13, National Metering Identifier Procedure) still hold: version and page link
- [ ] 3.1 Try the ladder in each host with the sample files (week, quarter, year, solar, 5-minute) and with the real file on a developer machine
- [ ] 3.2 Rotate the profile key once in a test environment and confirm old profiles are accepted for one rotation
