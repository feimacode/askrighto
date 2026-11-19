# Tasks

## 1. Verify

- [x] 1.1 On a machine that reaches retailer sites, hand-check the official website of each brand in `retailers.json` and record `website` and `websiteCheckedAt`; verify every active brand has one or is listed as having none
  - Done 19 Nov 2026 for what could be reached: 45 of 92 brands have a hand-checked website; 47 have `noWebsite` with the reason (list in design.md). The tasks says "or is listed as having none", so the consistency test accepts a reason. Origin, Flipped, Nectr, Next Business and Energy Locals/Indigo need a person to confirm an address.
- [x] 1.2 Count plan id suffixes in the stored plans; open 10 real `@EME` offers in the EME URL pattern (with and without a trailing version digit, and 2 gas offers) and record which open; update the design with what holds
  - Done: suffix counts (`@EME` 7,808, `@VEC` 4,450, all ids end in digits or a letter as described) and 16 plain GETs to EME. The pages are client-rendered, so a plain GET returns the same shell for every id including a made-up one: it proves the pattern is served, not that an offer resolves. See design.md.
- [x] 1.3 Check the EME and retailer link wording against `docs/legal/` notes; verify no wording implies endorsement or a plan page where it is not one
  - Done: `docs/legal/` has no notes on links; wording checked against the spec (see design.md).

## 2. Build

- [x] 2.1 Add `src/energy/links.ts` (build link and label from plan id, postcode, brand) with unit tests for each spec scenario
  - Done: `src/energy/links.ts` and `test/energy/links.test.ts`.
- [x] 2.2 Use it in `search_energy_plans`, `get_energy_plan` (optional `postcode`) and `compare_energy_plans` for markdown and Inkview; verify tests show the label and no plan-id-as-link
  - Done: link column and notes in the three tools (markdown and Inkview); `get_energy_plan` takes an optional `postcode`. Tests check the label and that the plan id is never a link. Inkview captions are capped at 300 characters, so the link notice is in the text form, not the caption.
- [x] 2.3 Add the consistency test for brand websites; update `docs/energy-data.md` and `docs/data-rights.md`
  - Done: consistency test, `docs/energy-data.md` (Plan links), `docs/data-rights.md` and `src/core/rights.json` (links only).

## 3. Before shipping

- [ ] 3.1 Re-check the EME URL pattern still opens a sample of offers
