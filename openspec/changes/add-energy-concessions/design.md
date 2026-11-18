# Design

## Context

`compare_energy_plans` estimates a yearly cost per plan from CDR plan data (`src/energy/calc.ts`) and returns it with the CDR source and the stored data's as-of date. The CDR plan contract has no concession field (CDS 1.35.0 `EnergyPlanContractV3`: eligibility, discounts, incentives, fees and so on, but no concessions); `SENIOR_CARD` exists only as an eligibility restriction. Concessions are state programs, published on state government pages, and change each 1 July.

## Goals / Non-Goals

**Goals:**
- One yes/no question, no personal detail, nothing stored.
- Every concession figure traces to an official page with a checked date, separately from the CDR source.
- The plan ordering is unchanged by the answer.

**Non-Goals:**
- Telling the user which concession they qualify for, or checking eligibility.
- Modelling every concession: medical cooling, life support, excess-usage and one-off relief payments get a link only.

## Decisions

**Rules are a hand-keyed JSON file in the repo (`src/energy/concessions.json`), not a database table.** The set is small (a few rules per state), changes once a year and must be reviewed by a person against the official page. A git diff is that review. Alternative: a table loaded by a script; rejected because there is no source to sync from and the review would happen outside git.

Each rule:
```json
{ "id": "vic-annual-electricity", "state": "VIC", "fuel": "ELECTRICITY",
  "name": "Annual Electricity Concession",
  "eligibility": "Pensioner Concession Card, Health Care Card or DVA Gold Card holders",
  "calc": { "kind": "percentOfBill", "rate": "0.175", "excludeFirstCents": null, "capCents": null },
  "sourceUrl": "https://services.dffh.vic.gov.au/annual-electricity-concession",
  "checkedAt": "2026-11-20" }
```
`calc.kind` is one of `fixedYearly`, `fixedDaily` (x 365), `percentOfBill` (with optional exclusions or cap). The figures above are an example of shape only; the real values are keyed from the page in task 1. If a page's rule cannot be expressed in these kinds, the state gets `link only` and no figure.

**State from postcode.** Nothing in the code maps a postcode to a state today (`COVERAGE_STATES` is a display string). Add the Australia Post postcode ranges by state (2xxx NSW with the ACT ranges 2600-2618 and 2900-2920 carved out, 3xxx VIC, 4xxx QLD, 5xxx SA, 7xxx TAS) as a small table with a test per boundary. A postcode served in two states (a handful near borders, such as 2620 and 3644) returns a needs-input asking which state, only when `concessionCard: yes`. Alternative: a postcode dataset (ABS correspondence); rejected as heavier than the ranges need.

**After-concession figure is computed after the main estimate, per plan.** `costAfterConcessionCents = max(0, total - concession(total))`. The percentage applies to the total including GST, because state pages describe the concession as a share of the bill. The ordering, the conditional-discount table and the totals are untouched; the figure is an extra field and column. Alternative: re-rank by cost after concession; rejected because the concession is the same or proportional across plans, so the order barely moves, and keeping one ordering keeps the result neutral and simpler to explain.

**Source on the result.** The tool result keeps its CDR `source` and `asOf`, and gains `concession: { id, name, eligibility, sourceUrl, checkedAt, applied: boolean, reason? }`. The text output lists the concession with its link and checked date under the tables; the Inkview table gets a "Cost after concession" money column when applied.

**Staleness.** A rule with `checkedAt` before the latest 1 July is not applied (spec). A unit test fails when any rule in the file is stale, so CI flags the July re-check.

**Host guidance.** Server instructions and the `energy-bill-comparison` skill: ask once "Does anyone in the household hold a pensioner, health care or DVA card?" Pass `yes`/`no`; never ask which card. Say the after-concession figure assumes eligibility and that the retailer applies it once the card is registered.

## Risks / Trade-offs

- [A state changes its concession mid-year] → staleness check only catches 1 July; the docs name each state's page to watch, and the result always says the figure is an estimate with the link.
- [Percentage concessions with exclusions are misread] → each rule's test case reproduces the worked example from the official page where one is published.
- [Licence of a state page is not open] → that state ships link-only; facts are written in our own words either way.
- [User answers yes but isn't eligible] → the wording says "if eligible", and eligibility is quoted from the page.

## Migration Plan

No data migration. Ship with the JSON, deploy, no sync or renormalise needed. Rollback is a redeploy.
