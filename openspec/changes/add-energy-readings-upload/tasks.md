# Tasks

## 1. Verify

- [ ] 1.1 Read the NEM12 sections of the MDFF specification (v27) for 200, 300, 400 records, quality and method flags, and interval lengths; list what the reader must accept beyond the sample
- [ ] 1.2 Survey time windows in stored plans (17 Nov load): how many plans have complete, non-overlapping windows, how many label bands oddly (AGL SHOULDER/SHOULDER); decide the "not estimated" rules from the numbers
- [ ] 1.3 Check which hosts can pass a 100 KB tool argument (Claude, ChatGPT, Gemini) and record the answer

## 2. Build

- [ ] 2.1 NEM12 reader with the sample's quirks (no 100/900, short last line, missing day); verify with an anonymised copy of the sample and the spec's own examples
- [ ] 2.2 Summary: monthly by hour of day, quality counts, missing days, identifiers dropped; verify no NMI or serial in output or logs
- [ ] 2.3 `summarise_energy_readings` tool, size cap and error messages; verify each spec scenario
- [ ] 2.4 Interval costing in `calc.ts` using plan windows, daylight saving and state; verify against a hand-worked plan
- [ ] 2.5 `compare_energy_plans` accepts the summary, labels the basis, hides the readings prompt; verify markdown and Inkview, including the 300-character caption cap
- [ ] 2.6 Server instructions, energy bill skill and `docs/energy-readings.md` (what the tool does and does not do)

## 3. Before shipping

- [ ] 3.1 Run Iven's real file locally and compare one plan by hand
- [ ] 3.2 Test the paste size in Claude, ChatGPT and Gemini
