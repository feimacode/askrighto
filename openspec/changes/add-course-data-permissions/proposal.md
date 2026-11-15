# Proposal

## Why

Uni course research is the next build after energy, and it is the first vertical whose data has no open licence. The rights research of 12 and 13 November 2026 found that no tertiary admissions centre (VTAC, UAC, QTAC, TISC, SATAC) offers an open licence, VTAC's terms allow personal non-commercial use only and ban extraction without written permission, and Course Seeker, the national site run by the Department of Education with the TACs, has no open licence either but gives one address for reproduction requests. Energy never needed this, because CDR rule 2.6 settled reuse for every retailer at once.

So the course vertical needs two things before anything ships: a written process for asking permission and recording the answers, and a rule in the server that a dataset cannot be served until its reuse basis is recorded and cleared. Permission replies take weeks to months, and the target is to be live by July 2027, ahead of mid-year subject selection and VTAC preferences opening in August. The requests should go out now, in parallel with the build, which is why this change comes first.

## What Changes

- Add a data rights register (`docs/data-rights.md`, plus a machine-readable copy the server reads) listing every dataset and source page family the server uses, with its owner, reuse basis, the evidence for it (terms page URL and the date it was read), any attribution wording, and its status.
- Define the reuse bases the project accepts: `open_licence` (for example CC BY), `cdr_rule` (CDR rule 2.6), `written_permission` (with a reference to the stored reply), and `own_words_facts` (individual facts re-keyed in our own words with a link to the official page, no copying of text or tables). Add `pending` for sources waiting on an answer.
- Make the data source registry refuse to serve a dataset whose rights status is `pending` or missing in production: its tools return `found: false` with reason `data_unavailable`, and `list_data_sources` shows it as not yet available. Development and test builds may serve it with a warning.
- Carry required attribution text from the register into every result built from that source, through the envelope's existing `source.attribution` field.
- Prepare permission requests (drafts kept in `docs/permissions/`, never sent by the build) to, in order: Course Seeker (national, CourseSeeker@education.gov.au), VTAC (course facts, the scaling report, study area groupings, preference and SEAS rules), and VCAA (key dates; school subject availability later). UAC and QTAC follow in Phase 6.
- Keep a permission log (`docs/permissions/log.md`): who was asked, what for, when, the reply, and any conditions. Replies themselves are stored outside the public repo if they contain personal details.
- Add a correction and takedown route: a contact on askrighto.com.au for universities and admissions centres, a target to correct or remove a disputed fact within five business days, and a register entry for each request.
- Re-check each source's terms page before release and once per admissions year, and record the date read.

Data source: none new. This change governs the sources added by `add-vic-course-data` and `add-vce-admissions-data`, and records the existing energy source (CDR rule 2.6) in the same register. Refresh cadence: the register is reviewed before each release and every August, when the next admissions year's guides are published.

Hosts affected: none directly. A dataset held back by this rule shows up in Claude, ChatGPT and Gemini as an explicit "not available yet" answer instead of data.

Out of scope:

- Sending any permission request. Drafts are prepared here; Iven sends them.
- The legal view on re-keying course facts in our own words. The register records that it is pending; a lawyer gives it.
- NSW and QLD sources (UAC, QTAC, NSW and QLD universities). Phase 6 adds them to the same register.
- Paying for data or signing a commercial data licence (no purchased data).
- Any scraping of TAC or Course Seeker sites while waiting for a reply.

## Capabilities

### New Capabilities

- `data-rights`: how each data source's right to reuse is recorded, checked and enforced, how required attribution reaches the user, and how permission requests and corrections are handled.

### Modified Capabilities

None. The registry behaviour added here lives in the new capability, so the not-yet-archived `grounded-results` spec stays unchanged.

## Impact

- New docs: `docs/data-rights.md`, `docs/permissions/` (request drafts, log, correction process).
- New code (when implemented): a rights file read at start-up (for example `src/core/rights.json`), a `rights` field on `DataSet` in `src/core/registry.ts`, and a production gate in `list_data_sources` and the tool wrapper.
- New setting: `ASKRIGHTO_ENV` (`production` or `development`) if the existing config does not already tell the two apart.
- Website (askrighto.com.au): a short "sources and corrections" page with the contact address. Lives with the privacy page from `add-claude-listing`.
- Depends on `add-mcp-server-core` (registry, envelope). Blocks the production release of `add-vic-course-data`, `add-vce-admissions-data` and `add-vic-course-tools`, not their development.
