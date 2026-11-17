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
