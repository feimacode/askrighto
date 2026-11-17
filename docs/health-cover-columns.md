# PHIO file layout: what is assumed

**No real file has been opened.** Cloud sessions cannot reach data.gov.au, so the parser in `src/health/parse.ts` reads a layout **assumed** from the dataset's description (one XML file per insurer, an XML schema, change CSVs, a hospital agreements CSV) and from what a third-party API says the file holds. Task 1.1 of `add-health-cover-data` stays open until someone opens a real ZIP from a machine that can reach the dataset and replaces this page with the true layout.

Dataset: https://data.gov.au/data/dataset/private-health-insurance (CC BY 3.0 AU, owner: Private Health Insurance Ombudsman, monthly ZIP, about 66 MiB for November 2025).

## Assumed layout the parser reads

```
<Insurer><Code/><Name/><Products><Product>
  <Code/><Name/><Type/>           Hospital | GeneralTreatment | Combined
  <Tier/><State/><Household/>     Single | Couple | Family | SingleParent
  <ExcessAmount/><ExcessType/><InfoUrl/>
  <Premiums><Premium><Amount/><Frequency/><Basis/><RebateTier/></Premium></Premiums>
  <ClinicalCategories><Category code label cover/></ClinicalCategories>   cover: Covered | Restricted | NotCovered
  <WaitingPeriods><WaitingPeriod type months/></WaitingPeriods>
</Product></Products></Insurer>
```

Element names are matched loosely (case and punctuation ignored). A field that is absent stays unset. `Basis` of a premium is `BeforeRebate`, `AfterRebate` (with `RebateTier`: Base, Tier1, Tier2, Tier3) or missing (stored as `unknown`; the rebate calculator then refuses to estimate).

## What to check against a real file

| Question | Why it matters |
| --- | --- |
| Element and attribute names, nesting, one file per insurer or one for all | Parser paths |
| The grain of one product row (state, household, age band?) | Product id uniqueness and the duplicate report |
| Are premiums before rebate, after a rebate tier, or both? | Decides how much `estimate_premium_after_rebate` calculates versus shows as published |
| Hospital tier codes and clinical category codes and labels | Stored as published; confirm names the tools list |
| Excess types (per admission, per year) and whether family excess differs | Excess display |
| Is the hospital agreements CSV needed? | Not loaded yet |
| Does the file carry a link to each product's information statement? | `infoUrl` is set only when it does |
| `Readme.txt` attribution or reuse wording | Rights entry attribution |
| Whether restricted-membership funds are flagged | Eligibility note |

## Operator routine (monthly)

1. Download the new ZIP from the dataset page (names look like `privatehealth-01-nov-2025.zip`; the November 2025 file was dated 3 November, so run on the 4th) and unzip it into a folder.
2. `npm run health:validate -- --dir FOLDER` and read the counts and problems.
3. `npm run health:load -- --dir FOLDER --source-date YYYY-MM-DD` (the file's own date; it is shown as the as-of date).
4. After each 1 April and 1 July, run `npm run health:rates-validate` and review `data/health/rates.yaml` against the ATO pages.
