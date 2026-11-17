## Context

The source is one ZIP a month: XML per insurer and product, an XML schema, change CSVs, and a hospital agreements CSV (`docs/health-cover-research.md`, section 1). The third-party API that wraps it says it carries 38 clinical categories and 27 general treatment services per product, state-specific premiums and 117,000+ product rows from 34 funds. None of that is verified. The pattern to follow is `add-intl-course-data`: verify the real file first, load it all in one transaction, keep nulls as nulls.

## Decisions

1. **Verify columns first.** Task 1.1 opens a real ZIP and writes `docs/health-cover-columns.md`. Where a field the proposal expects is absent (for example premium after rebate by tier), the dependent requirement moves to the rates change (calculate it, labelled "calculated") or is dropped.
2. **Own tables, rebuildable.** `health_insurers`, `health_products`, `health_product_categories`, `health_product_services`, `health_waiting_periods`, `health_hospital_agreements`, `health_load`. `health:load` replaces everything from one ZIP in a single transaction and records the file name, its date and a hash. The raw XML is not stored; the file is the source of record.
3. **Keep the file's own codes.** Tier, clinical category and service are stored by the code and label the file uses, with the schema version. Nothing is hard-coded to "Gold, Silver, Bronze, Basic" or to 38 categories, because the July 2026 reform consultation proposes consolidating tiers and may change categories.
4. **One row per product variant.** The file's grain (product by state, household type, age group) decides the key; the loader asserts uniqueness and `health:validate` reports duplicates. Search results later collapse variants for display.
5. **Money as integer cents, as published.** Premiums are stored per payment frequency exactly as the file states, with the file's rebate basis recorded (before rebate, after a stated tier, or both). Nothing is rounded or inferred; a missing figure stays null and is described as "not published".
6. **Coverage statement from the data.** `health:validate` writes the count of insurers and products in the file. Every tool result later says "products in the PHIO file dated <date>", never "all funds" or "the market" (the lesson of the 2026 Choosi judgment, `docs/health-cover-research.md` section 3).
7. **Refresh and staleness.** Operator runs `health:load` after the file appears (the November 2025 file was dated 3 November, so run on the 4th). `maxAgeHours` for the registry is 45 days. Results carry a warning when the stored file's date is earlier than the most recent 1 April or 1 July, because premiums change on those dates. Insurers lodge 2027 changes in November 2026 and apply them mostly from 1 April 2027 (unverified per insurer).
8. **Rollback.** The previous load is kept as a snapshot (a second schema-scoped table set swapped by rename inside the transaction, or the last two ZIP hashes recorded so an operator can reload the previous file). Pick the simpler one at implementation; the requirement is only that a bad month can be undone by one command.
9. **Rights.** New entry `health-cover-products`: basis `open_licence`, status `cleared_pending_legal_view` until the legal view lands, review by 2027-08-01, evidence the data.gov.au record and the readme, attribution "Private health insurance product data: Private Health Insurance Ombudsman, via data.gov.au, licensed CC BY 3.0 AU" (replace with any wording the ZIP's `Readme.txt` requires). Conditions: dataset only, never the privatehealth.gov.au site; terms page for that site to be read and recorded.
10. **Source link per result.** Each result carries the dataset URL as `source`, the file date as `asOf` and, where the file carries a policy's PHIS page address, that link. No link is built by guessing the website's URL pattern.

## Risks / Trade-offs

- The file's grain and field names may differ from the third-party description; decision 1 contains that.
- 66 MiB zipped means a large XML parse. Stream it; do not hold it all in memory.
- Insurers can publish a product after the monthly cut-off, so the file can lag the insurer's site. Every product result tells the person to confirm with the insurer, echoing PHIO's own disclaimer.
- Restricted-membership funds may appear in the file but not be open to everyone. Whether the file flags this is unknown; if it does, show it, if not, say "check eligibility with the insurer".

## Open Questions

- Does the file state premiums after rebate for each tier, or only before? (Decides how much `add-health-cover-rates` has to calculate.)
- Which licence text does the ZIP's `Readme.txt` carry, and does it add attribution wording?
- Does any trade mark guidance restrict showing insurer names? (Part of the legal view.)

## Implementation notes (17 Nov 2026)

- First built against an assumed layout; on 17 Nov 2026 the real November 2026 ZIP was opened and the parser, model and schema were rewritten to match (`docs/health-cover-columns.md`). Differences from the proposal: one XML file per cover type and open or closed status plus a Funds file (not per insurer); product files run to 684 MB, so they are streamed; the key is `ProductID`; there is a single monthly before-rebate premium per product and no after-rebate figure, so premiums after rebate are always calculated; seven hospital tiers; 38 clinical categories stored as one letter each; no product information statement link (`PHISURL` is nil), only the insurer's `ProductURL`; the owner on the dataset record is the Commonwealth Ombudsman. Closed products are skipped by default. Tasks 1.3 and 1.4 stay open.
- `health:load` reads an unzipped folder of XML files. Rollback (decision 8) and the hospital agreements CSV are not built.
