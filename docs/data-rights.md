# Data rights register

Every dataset the server serves has an entry here and in `src/core/rights.json` (the machine copy; a test fails if the two disagree).
In production a tool reading a dataset whose status is not `cleared` or `cleared_pending_legal_view` answers `data_unavailable`; in development it answers with a warning.

**Bases:** `open_licence`, `cdr_rule`, `written_permission`, `own_words_facts`. **Statuses:** `cleared`, `cleared_pending_legal_view` (served, but blocks public listing), `pending`, `refused`, `withdrawn`.

Corrections and take-downs: see [permissions/log.md](permissions/log.md#corrections-process). Permission requests: [Course Seeker](permissions/course-seeker.md), [VTAC](permissions/vtac.md), [VCAA](permissions/vcaa.md).

## energy-plans

- Owner: Australian Energy Regulator (Consumer Data Right product reference data)
- Basis: `cdr_rule`
- Status: `cleared`
- Review by: 2027-02-01
- Evidence: https://www.aer.gov.au/energy-product-reference-data (read 2026-11-11). CDR Rules rule 2.6: a data holder must not restrict use of disclosed product data. Only the Feb 2020 version of the rule was read; confirm it is unchanged.
- Condition: The Energy Made Easy and Victorian Energy Compare websites are not scraped; the API only.
- Condition: Links to Energy Made Easy and to retailer websites are links only: those pages are not fetched, read or stored by the server.
- Condition: Distributor and retailer meter data request pages and the AEMC rule on access to data are linked and paraphrased; nothing is stored from them but the link, the check date and a one-line note.
- Condition: A household's own interval readings, if supplied, are read for that request only: never stored or logged, with the NMI and meter serial dropped. They are the person's own data, not a dataset.

## cricos-register

- Owner: Australian Government Department of Education (CRICOS, on data.gov.au)
- Basis: `open_licence`
- Status: `cleared`
- Review by: 2027-08-01
- Evidence: https://data.gov.au/ (read 2026-11-12). CRICOS dataset published under CC BY 2.5 AU. Names, providers, codes and locations only; no ATARs.
- Attribution: Course names, codes and locations: CRICOS, Australian Government Department of Education, via data.gov.au, licensed CC BY 2.5 AU.

## intl-courses

- Owner: Australian Government Department of Education (CRICOS, on data.gov.au)
- Basis: `open_licence`
- Status: `cleared`
- Review by: 2027-08-01
- Evidence: https://data.gov.au/ (read 2026-11-12). CRICOS dataset published under CC BY 2.5 AU. Same source as the cricos-register entry; here used for fees, durations and locations of courses for international students. Which fields the file holds is confirmed in docs/cricos-columns.md once a real file is opened.
- Attribution: Course names, codes, fees, durations and locations: CRICOS, Australian Government Department of Education, via data.gov.au, licensed CC BY 2.5 AU. Fees are indicative.
- Condition: Fees shown as indicative, as published, with the file date.
- Condition: No English, entry-requirement, scholarship or intake facts are stored.

## vic-courses

- Owner: Each Victorian university (course pages and admissions transparency pages)
- Basis: `own_words_facts`
- Status: `cleared_pending_legal_view`
- Review by: 2027-08-01
- Evidence: https://www.vtac.edu.au/copyright.html (read 2026-11-12). VTAC terms: personal non-commercial use only, no extraction without written permission. So no VTAC or Course Seeker content is used; facts come from the universities' own pages, re-keyed in our own words with a link.
- Condition: Facts only, in our own words, with a link on every fact.
- Condition: Legal view on re-keyed facts outstanding (roadmap Phase 0).

## vce-key-dates

- Owner: VCAA and VTAC (key dates pages)
- Basis: `own_words_facts`
- Status: `cleared_pending_legal_view`
- Review by: 2027-02-01
- Evidence: https://www.vcaa.vic.edu.au/administration/key-dates/key-dates (read 2026-11-12). Individual dates re-keyed in our own words with a link. VCAA terms page not yet read; request drafted (docs/permissions/vcaa.md).
- Condition: VCAA terms still to be read.

## vtac-preference-rules

- Owner: VTAC (preferences and offers pages)
- Basis: `own_words_facts`
- Status: `cleared_pending_legal_view`
- Review by: 2027-08-01
- Evidence: https://www.vtac.edu.au/offers (read 2026-11-12). Rules stated as individual facts in our own words with a link. VTAC asked to confirm (docs/permissions/vtac.md).
- Condition: Reword, never copy; VTAC reply pending.

## vic-early-entry

- Owner: Each Victorian university's early offer scheme page
- Basis: `own_words_facts`
- Status: `cleared_pending_legal_view`
- Review by: 2027-08-01
- Evidence: https://www.vtac.edu.au/institutions/earlyofferprograms (read 2026-11-12). Scheme facts re-keyed from each university's own scheme page, linked. No eligibility verdicts.

## vce-scaling

- Owner: VTAC (annual scaling report)
- Basis: `written_permission`
- Status: `pending`
- Review by: 2027-02-01
- Evidence: https://www.vtac.edu.au/copyright.html (read 2026-11-12). No reuse without written permission. Request drafted (docs/permissions/vtac.md), not sent.

## vce-study-groupings

- Owner: VTAC (study area groupings fact sheet)
- Basis: `written_permission`
- Status: `pending`
- Review by: 2027-02-01
- Evidence: https://www.vtac.edu.au/copyright.html (read 2026-11-12). No reuse without written permission. Request drafted (docs/permissions/vtac.md), not sent.

## vtac-coursesearch

- Owner: VTAC (CourseSearch)
- Basis: `written_permission`
- Status: `pending`
- Review by: 2027-02-01
- Evidence: https://www.vtac.edu.au/copyright.html (read 2026-11-12). Extraction banned without written permission. Used only to block facts sourced from vtac.edu.au pages.

## course-seeker

- Owner: Department of Education and the admissions centres (Course Seeker)
- Basis: `written_permission`
- Status: `pending`
- Review by: 2027-02-01
- Evidence: https://www.courseseeker.edu.au/ (read 2026-11-13). No open licence. Deep links are fine; copying needs permission (CourseSeeker@education.gov.au). Request drafted (docs/permissions/course-seeker.md), not sent.

## home-loans-cdr

- Owner: Each lender, via the Consumer Data Right (banking product reference data)
- Basis: `cdr_rule`
- Status: `cleared_pending_legal_view`
- Review by: 2027-03-01
- Evidence: https://cdr-support.zendesk.com/hc/en-us/articles/900004104506 (read 2026-11-17). Product Reference Data needs no authentication. The CDR Rules simplified outline (rule 1.4) says a data holder cannot impose conditions on use of disclosed data; the operative rule number was not read.
- Condition: API only; comparison sites and lender web pages are not scraped.
- Condition: Rates and fees shown as published, never recomputed.
- Condition: Public listing needs the credit legal view (docs/home-loans-research.md section 2) and the marker docs/legal/home-loans-view.md.

## rba-cash-rate

- Owner: Reserve Bank of Australia
- Basis: `open_licence`
- Status: `cleared_pending_legal_view`
- Review by: 2027-03-01
- Evidence: https://www.rba.gov.au/copyright/ (read 2026-11-17). Financial data (the cash rate) may be used commercially if RBA endorsement is not stated or implied; attribute "Source: Reserve Bank of Australia". Tables F5 and F6 are not used: third-party content not checked.
- Attribution: Source: Reserve Bank of Australia 2026. The RBA does not endorse Ask Righto.
- Condition: Cash rate target only; no other RBA series.
- Condition: No statement that the RBA endorses Ask Righto.

## health-cover-products

- Owner: Commonwealth Ombudsman (PrivateHealth.gov.au dataset, on data.gov.au)
- Basis: `open_licence`
- Status: `cleared_pending_legal_view`
- Review by: 2027-08-01
- Evidence: https://data.gov.au/data/dataset/private-health-insurance (read 2026-11-17). Dataset record and resource pages show Creative Commons Attribution 3.0 Australia, owned by the Ombudsman, monthly ZIP. No file has been opened yet; the ZIP's Readme.txt may add attribution wording. The privatehealth.gov.au site terms are unread.
- Attribution: Private health insurance product data: Commonwealth Ombudsman (PrivateHealth.gov.au), via data.gov.au, licensed CC BY 3.0 AU.
- Condition: Dataset only: the privatehealth.gov.au website is never scraped, framed or fetched.
- Condition: Results say the data covers products in the Ombudsman's file, not all funds or the whole market.
- Condition: Legal view outstanding (roadmap Phase 0): information-only comparison, Australian Consumer Law wording, tax agent services, privacy.

## health-cover-rates

- Owner: Australian Taxation Office and Department of Health, Disability and Ageing (rebate, Medicare levy surcharge and Lifetime Health Cover pages)
- Basis: `own_words_facts`
- Status: `cleared_pending_legal_view`
- Review by: 2027-04-01
- Evidence: https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/private-health-insurance-rebate/income-thresholds-and-rates-for-the-private-health-insurance-rebate (read 2026-11-17). Thresholds and rates re-keyed as numbers with source links; no page text copied. The ATO and Department of Health reuse licence has not been confirmed.
- Condition: Rows carry the source page's updated date, effective dates and status; a proposed change is never used in a figure.
- Condition: Reviewed each 1 April and 1 July.
- Condition: Licence of the ATO and Department of Health pages to be confirmed.

## career-outcomes

- Owner: Jobs and Skills Australia (employment projections, jobsandskills.gov.au)
- Basis: `open_licence`
- Status: `cleared_pending_legal_view`
- Review by: 2027-08-01
- Evidence: https://www.jobsandskills.gov.au/copyright-and-disclaimer (read 2026-11-18, page last modified 19 May 2025): site content is under CC BY 4.0 except third-party content, the Commonwealth Coat of Arms, trade marks and images; required attribution "© Commonwealth of Australia". The workbook carries no licence text of its own. Also https://www.jobsandskills.gov.au/data/employment-projections (read 2026-11-18): May 2025 to May 2035 projections, indicative, not reflecting generative AI. The earlier `labourmarketinsights.gov.au` site named in planning does not exist (no DNS record on 18 Nov 2026); the data.gov.au copies are frozen (CC BY 2.5 AU, last updated Aug 2023) and are not used.
- Attribution: Employment projections: Jobs and Skills Australia, © Commonwealth of Australia, licensed CC BY 4.0.
- Condition: Only the employment projections workbook is loaded. The OSCA and ANZSCO profile workbooks are ABS-derived and need ABS credit and their own review before use.
- Condition: JSA pages are linked, never framed, altered or reformatted on another site.
- Condition: Results carry the projections' own caveat: indicative, and not reflecting generative AI.
- Condition: Legal view outstanding (roadmap Phase 0): information-only use, JSA's no-warranty disclaimer.

## aer-benchmarks

- Owner: Australian Energy Regulator (Simple electricity and gas benchmarks, analysis by Frontier Economics, aer.gov.au)
- Basis: `open_licence`
- Status: `cleared_pending_legal_view`
- Review by: 2027-08-01
- Evidence: https://www.aer.gov.au/about/policies/disclaimer-copyright (read 2026-11-18): all material on the AER website is under CC BY 4.0, except the Coat of Arms, AER logos, content supplied by third parties and material where it is expressly stated otherwise. Attribution "Source: AER © Commonwealth of Australia"; if modified, "Source: Based on AER data". The workbook states no exception. Also https://www.aer.gov.au/documents/frontier-economics-simple-electricity-and-gas-benchmarks-june-2021 (read 2026-11-18): "Simple electricity and gas benchmarks - published December 2020. Updated June 2021 for postcodes" (XLSX). Frontier Economics did the analysis for the AER. No newer edition was found on 18 Nov 2026. The AER must update the benchmarks at least every three years under the National Energy Retail Rules, so a newer edition may be published; the loader is re-run if so.
- Attribution: Source: AER © Commonwealth of Australia, simple electricity and gas benchmarks (analysis by Frontier Economics), CC BY 4.0. Values re-keyed unchanged.
- Condition: Only the benchmark values and the postcode-to-zone lists are loaded, re-keyed unchanged. The workbook is not committed or republished; test fixtures are synthetic.
- Condition: Results call the figure typical household use for that zone and size, never the person's own, and carry the release date (December 2020, postcodes June 2021).
- Condition: Frontier Economics authored the analysis and the AER publishes it under the site licence; the legal view should note that.
- Condition: Legal view outstanding (roadmap Phase 0): information-only use.

## aemo-material

- Owner: Australian Energy Market Operator (AEMO)
- Basis: `open_licence`
- Status: `cleared`
- Review by: 2027-11-20
- Evidence: https://www.aemo.com.au/privacy-and-legal-notices/copyright-permissions (read 2026-11-20): AEMO's copyright permissions statement, pasted into the project thread by Iven on 20 Nov 2026: AEMO gives general permission for anyone to use AEMO Material for any purpose, with accurate and appropriate attribution to the material and to AEMO as author, and no specific permission is needed. Confidential documents and reports commissioned by others are not AEMO Material. The page address is as recalled and was not fetched by the assistant; confirm it when next read.
- Attribution: Meter data file rules and stream codes follow AEMO's Meter Data File Format Specification NEM12 & NEM13 and National Metering Identifier Procedure; distributor names follow AEMO's NMI allocation list. Source: AEMO.
- Condition: Only AEMO Material is used: the published NEM12/NEM13 specification, the NMI Procedure and the NMI allocation list. Confidential documents and reports commissioned by another body are not used.
- Condition: What we take is rules and names, written in our own words and code (record types, stream suffix meanings, interval lengths, distributor names). No AEMO document or table is copied into the repo or the product.
- Condition: Attribution is kept where the material is used: the readings docs and the readings tool's source name say AEMO is the author, and the recipe cites the document and edition it follows.
- Condition: The household's own readings file is the person's data, not AEMO Material, and is handled as the energy-plans entry says.
