# Design

## Context

Findings this design rests on (thread "Confirm uni course data usage rights", 12 to 13 Nov 2026, report https://claude.ai/artifact/XRPC7qqi7ssJ3RBHK2FDXM):

- VTAC's copyright page (updated 16 Feb 2026) allows personal, non-commercial use and bans extracting or reproducing content without written permission. UAC, QTAC and TISC are the same or stricter. SATAC has no terms page, so all rights are reserved by default.
- Course Seeker (courseseeker.edu.au) aggregates all states with ATARs, prerequisites and student profiles. Its copyright page has no Creative Commons licence; reproduction requests go to CourseSeeker@education.gov.au, and institution-supplied material needs the institution's permission. Deep linking is fine.
- CRICOS on data.gov.au is CC BY 2.5 AU (course names, providers, locations; no ATARs).
- The previous pilot's `vic-university-atar-catalog.csv` is hand-compiled facts with official links, the pattern the roadmap adopts. Its `vtac-courses.csv`, `uac-nsw-courses.csv` and `qtac-qld-courses.csv` are scraped and must not ship.
- The pilot also ingested the VTAC scaling report PDF, VTAC study area groupings, VTAC SEAS categories and preference mechanics, VCAA key dates and VCAA school subject availability. None of these has been licence-checked for public commercial reuse.

The server already has `Source.licence` and `Source.attribution` in the envelope (`src/core/grounded.ts`) and a `DataSet` registry (`src/core/registry.ts`). What is missing is a record of *why* we may use a source, and a rule that stops a source going live without one.

## Goals / Non-Goals

**Goals:**

- No dataset reaches production users unless its reuse basis is written down with evidence.
- Required attribution reaches the user on every result, without each tool remembering it.
- Permission requests go out early, are specific about what we want, and are tracked.
- A university or admissions centre can get a fact corrected or removed quickly.

**Non-Goals:**

- Deciding the legal question for us. The register records the basis and its evidence; a lawyer reviews the `own_words_facts` basis before launch.
- Automating the reading of terms pages. A person reads them and records the date.

## Decisions

**1. One register, two forms.** `docs/data-rights.md` is the human document; `src/core/rights.json` is the machine copy with one entry per dataset id. A test checks the two list the same ids, and that every dataset registered at start-up has an entry. Alternative: rights fields only in code next to each dataset. Rejected: the people who answer permission requests and the lawyer need one readable page.

Entry shape:

```json
{
  "datasetId": "vic-courses",
  "owner": "Each Victorian university (course pages, admissions transparency pages)",
  "basis": "own_words_facts",
  "status": "cleared_pending_legal_view",
  "evidence": [{ "url": "https://…/copyright", "readOn": "2026-11-12", "note": "facts only, no text copied" }],
  "attribution": null,
  "conditions": [],
  "reviewBy": "2027-08-01"
}
```

**2. Bases and statuses.** Bases: `open_licence`, `cdr_rule`, `written_permission`, `own_words_facts`. Statuses: `cleared`, `cleared_pending_legal_view`, `pending`, `refused`, `withdrawn`. Production serves `cleared` and `cleared_pending_legal_view`; the second is a deliberate, visible compromise so the build is not blocked on the lawyer, and the launch checklist (`add-claude-listing`) requires no `cleared_pending_legal_view` entries before public listing. `refused` and `withdrawn` mean the data is deleted from the store on the next load, not just hidden.

**3. Gate in the registry, not in each tool.** `DataSet` gains a `rights` field resolved from the register at start-up. The tool wrapper checks every dataset id a tool declares it reads; if any is not servable in production, the handler is not called and the result is `notFound("data_unavailable", "…is not available yet while we confirm we may reuse it", { datasetId })`. Alternative: leave the tool unregistered. Rejected: the host would not know the feature exists or why it is missing, and tool lists would differ between environments, which complicates directory review.

**3a. Pending data never enters the public repo.** The repository is public, so committing a pending source (for example the VTAC scaling table) would itself be redistribution. Development copies live in a git-ignored `data/local/` folder, and a CI check fails on any committed file that belongs to a dataset that is not cleared.

**4. Attribution from the register.** When a dataset's entry has `attribution`, the registry sets `source.attribution` on every `found` result built from it, so `renderText` prints it and structured content carries it. A test fails if any result from such a dataset lacks it.

**5. What we ask for, and of whom.**

| Recipient | Ask | Why this order |
| --- | --- | --- |
| Course Seeker (CourseSeeker@education.gov.au) | Permission to reuse course facts (entry figures, prerequisites, course names, links) for all states in a free, ad-free, stateless information service with links back | One national answer could cover VIC now and NSW and QLD later |
| VTAC | Permission for: the scaling report's scaled-score table, study area groupings, and course facts as published in CourseSearch; confirmation that own-worded preference rules, SEAS category descriptions and key dates with links are acceptable | VTAC is the owner of the scaling and groupings data that no university republishes |
| VCAA | Confirm reuse terms for key dates; later, school subject availability | VCAA terms were never checked (roadmap Phase 0) |

Each request says what the product is (free, no ads, no accounts, links to the official page on every fact), exactly which data, how it is shown, how often it is refreshed, and offers attribution in their wording. Drafts live in `docs/permissions/` and Iven sends them; nothing is sent from the build.

**6. Correction route.** A "sources and corrections" page on askrighto.com.au with a monitored address. A request is logged in `docs/permissions/log.md`, the fact is checked against the official page within five business days, and corrected or removed. Removal is a data file change plus a reload, so it needs no deploy of code.

**7. Review cadence.** Every entry has `reviewBy`. A test warns (not fails) when an entry is past its review date, and the release checklist fails on it. Course entries are reviewed every August.

## How results carry source and as-of date

This change adds no tool. Every result from a gated dataset still comes from `found({ data, source, asOf })`; the register only adds `source.attribution` where required and decides whether the handler runs at all. The not-available answer is a `NotFound` with reason `data_unavailable` and no figures.

## Risks / Trade-offs

- [The `own_words_facts` basis is our reading, not a legal view] → Recorded as `cleared_pending_legal_view`, visible in the register, and a hard gate before public listing.
- [VTAC refuses or never replies] → Course facts come from university pages, which do not depend on VTAC. Only the scaling-based aggregate estimate and study area groupings stay off; the rest of the vertical ships.
- [A permission arrives with conditions we cannot meet (for example no commercial use, while a paid tier is still undecided)] → Log the conditions; the roadmap's revenue question decides whether to accept.
- [Register and code drift apart] → Start-up fails in production if a registered dataset has no register entry; a test checks both forms list the same ids.

## Open Questions

- Who monitors the corrections address, and from when.
- Whether to tell each Victorian university about the service before launch, as a courtesy, even though their facts are re-keyed rather than copied.
