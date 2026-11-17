# Career outcomes: source files and columns

Read on 18 Nov 2026 from the JSA website through plain HTTP on the maintainer's computer (the cloud session's network blocks these hosts). No bot check was met. Files were not committed.

## Licence and attribution

Source: https://www.jobsandskills.gov.au/copyright-and-disclaimer (last modified 19 May 2025).

- Site content is under CC BY 4.0 except content supplied by third parties, the Commonwealth Coat of Arms, trade-marked material and images.
- Required attribution: "© Commonwealth of Australia".
- Linking is allowed, but the page says not to alter, frame or reformat JSA files, pages or materials on another website.
- JSA gives no warranty about accuracy, currency or completeness. Permissions contact: copyright@dewr.gov.au.
- The workbooks carry no licence text of their own.
- `labourmarketinsights.gov.au` (named in earlier planning) has no DNS record; the data.gov.au copies are frozen (CC BY 2.5 AU, last updated Aug 2023).

## Loaded: employment projections

- Page: https://www.jobsandskills.gov.au/data/employment-projections (modified 23 Jan 2026)
- File: `employment_projections_-_may_2025_to_may_2035.xlsx` (275,457 bytes; workbook dated 6 Nov 2025)
- Baseline May 2025; projections May 2030 and May 2035; VUEF model calibrated to Treasury. The page says projections are indicative and do not reflect generative AI.
- Classification: ANZSCO version 1.3 (stated in the Data_Dictionary sheet).
- Sheet loaded: the one named like `Table_6` (occupation unit group), about 670 rows. Header on rows 8 and 9, data from row 10, footnotes below. The loader finds the header by its "ANZSCO Code" cell, not by row number.

| Column | Stored as |
| --- | --- |
| Occupation Level (1 to 4) | `level` |
| NFD Indicator (Y or N) | `nfd` |
| ANZSCO Code (text, 1 to 4 digits) | `code` |
| Occupation | `name` |
| Skill level ("-" or 1 to 5) | `skill_level` |
| Baseline May 2025, Projected May 2030, Projected May 2035 ('000 people) | `baseline_k`, `proj_mid_k`, `proj_end_k` |
| 5-Year and 10-Year Change Level ('000) | `change5_k`, `change10_k` |
| 5-Year and 10-Year Change % (fractions, 0.0766 = 7.66%) | `change5_pct`, `change10_pct` |

Skill levels pair with qualifications in the Data_Dictionary: 1 bachelor or higher, 2 advanced diploma or diploma, 3 Certificate IV (or III with two years of on-the-job training), 4 Certificate II or III, 5 Certificate I or secondary. A unit group can span several skill levels (footnote on the sheet). There is no field of study anywhere in the file.

## Seen, not loaded

- **OSCA occupation data (2021 Census)**, modified 30 Jul 2026. OSCA codes (not ANZSCO), no projections, ABS-derived (perturbed, suppressed). JSA says a fuller OSCA release with projections is due November 2026: check before relying on ANZSCO long term.
- **ANZSCO occupation data, February 2026.** Employed, part-time and female share, median weekly earnings (mostly "N/A"), median age, past one-year growth, and Table_8 highest educational attainment by occupation. Joins on the same ANZSCO codes. Not loaded: pay is out of scope and the attainment table needs its own review.
- **Industry data, February 2026.** ANZSIC industries, not occupations.

## Operator routine

1. Download the workbook from the employment projections page.
2. `npm run careers:validate -- --file PATH.xlsx` (prints problems and exits non-zero on any).
3. `npm run careers:load -- --file PATH.xlsx --source-date YYYY-MM-DD` with the release date shown on JSA's page (needs `DATABASE_URL`).
4. Check the JSA page for a newer release at least every few months; the registry warns when the loaded data is over 400 days old.

The database tests (`test/careers/db.test.ts`) run only with `TEST_DATABASE_URL`; they were not run in the cloud session that wrote the loader.
