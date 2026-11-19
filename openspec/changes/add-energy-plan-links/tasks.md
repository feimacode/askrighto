# Tasks

## 1. Verify

- [ ] 1.1 On a machine that reaches retailer sites, hand-check the official website of each brand in `retailers.json` and record `website` and `websiteCheckedAt`; verify every active brand has one or is listed as having none
- [ ] 1.2 Count plan id suffixes in the stored plans; open 10 real `@EME` offers in the EME URL pattern (with and without a trailing version digit, and 2 gas offers) and record which open; update the design with what holds
- [ ] 1.3 Check the EME and retailer link wording against `docs/legal/` notes; verify no wording implies endorsement or a plan page where it is not one

## 2. Build

- [x] 2.1 Add `src/energy/links.ts` (build link and label from plan id, postcode, brand) with unit tests for each spec scenario
- [x] 2.2 Use it in `search_energy_plans`, `get_energy_plan` (optional `postcode`) and `compare_energy_plans` for markdown and Inkview; verify tests show the label and no plan-id-as-link
- [ ] 2.3 Add the consistency test for brand websites; update `docs/energy-data.md` and `docs/data-rights.md`

  - Done in cloud (no FengsPC needed): `src/energy/links.ts`, `test/energy/links.test.ts`, one tools test. Tasks 1.1-1.3 and the website half of 2.3 stay open: until `retailers.json` has hand-checked `website` entries, Victorian plans show "no link available".

## 3. Before shipping

- [ ] 3.1 Re-check the EME URL pattern still opens a sample of offers
