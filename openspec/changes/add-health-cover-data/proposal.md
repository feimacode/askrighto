## Why

Private health insurance is the second-ranked case in `ROADMAP.md` (Phase 5): complex (cover tiers, 38 clinical categories, excess, waiting periods), built from many insurers' products, and faced by most households. Unlike courses it has an openly licensed national file with no permission to wait for. A first research pass (`docs/health-cover-research.md`, 17 Nov 2026) found the PrivateHealth.gov.au dataset on data.gov.au, owned by the Private Health Insurance Ombudsman (PHIO) and published under CC BY 3.0 AU as a monthly ZIP. This change loads it. The file has not been opened yet, so its field list is unverified.

## What Changes

- Load the PHIO monthly ZIP (insurers, products, cover by clinical category, excess, premiums, waiting periods, hospital agreements) into new `health_*` tables under the `askrighto` schema, rebuildable from the file.
- Add a `health-cover` entry to the rights register with the licence, our own attribution line and the condition that the privatehealth.gov.au website is never scraped or framed.
- Refresh monthly with an operator command, keep the last few loads so a bad month can be rolled back, and warn in results when the file predates the latest premium change.
- First task: open a real ZIP from a machine that can reach data.gov.au (cloud sessions are blocked) and write `docs/health-cover-columns.md`, as was done for CRICOS.

Data source: PrivateHealth.gov.au dataset, `https://data.gov.au/data/dataset/private-health-insurance`, CC BY 3.0 AU, monthly (file names like `privatehealth-01-nov-2025.zip`, about 66 MiB). Refresh cadence: monthly, plus a check after each 1 April premium round.

Hosts affected: Claude, ChatGPT and Gemini only through the tools change; this change adds no tools.

Out of scope: tools (`add-health-cover-tools`), tax rates (`add-health-cover-rates`), overseas student and visitor cover, general insurance, anything from the privatehealth.gov.au website itself, APRA statistics.

## Capabilities

### New Capabilities
- `health-cover-data`: a rebuildable, monthly store of private health insurance products with provenance and attribution.

### Modified Capabilities
None. Reuses the rights register and migration runner.

## Impact

- New migration `0005-health.ts`, module `src/health/`, CLI commands `health:load` and `health:validate`, rights entry `health-cover-products`.
- New vertical id `health-cover` added to `KNOWN_VERTICALS` in `src/verticals.ts` (by the tools change), loaded on the internal route only.
- Operator step each month, like `intl:load`.
