## Why

The domestic course finder rests on a hard problem: official admissions facts (ATAR, prerequisites) are not openly licensed, so most rows are index-only and need a user-side browsing assistant. International students are a different case. The open CRICOS register (CC BY 2.5 AU, data.gov.au, monthly) is the legal list of every course a student visa holder may enrol in, with provider, course code, level, duration, locations and (per the register's published purpose) tuition fees. If CRICOS really holds those fields, an international finder could be mostly open data with no permission request. Iven asked (16 Nov 2026) to take this up so the two cases can be compared.

## What Changes

- Load CRICOS nationally into its own tables (`intl_courses`, `intl_course_locations`, `intl_providers`), rebuildable from the monthly file, separate from the domestic `courses` table.
- Cover higher-education levels first (associate degree, bachelor, graduate certificate/diploma, master, doctorate) plus diplomas and advanced diplomas as an open question; leave out school, ELICOS and non-award courses by default.
- Keep fee, duration, level, field of education, language of instruction and work-component facts exactly as published, labelled "indicative" with the file's as-of date and CRICOS attribution.
- Link to the domestic index through `cricos_code` so one course can be seen from both sides.
- Handle what CRICOS does not hold (English language entry requirements, scholarships, entry requirements by country) through links and a reading checklist for the user's own browsing assistant, never stored.
- First step of the work: open a real CRICOS download and record the true sheets and columns in `docs/cricos-columns.md`. The columns are unverified today.

## Capabilities

### New Capabilities
- `intl-course-data`: national CRICOS-based store of courses for international students, with provenance, fee labelling and links to the domestic index.

### Modified Capabilities
None. Reuses the `cricos` entry in the rights register and the `cricos_raw` table from `add-vic-course-data`.

## Impact

- New migration `0004-intl.ts`, new module `src/intl/`, new CLI commands `intl:load` and `intl:validate`.
- New vertical id `international` in `src/verticals.ts`, internal-only until promoted.
- No migration or visa advice: this is course facts, not immigration advice (AGENTS.md rule 5 spirit).
