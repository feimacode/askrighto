> **Superseded in part (27 Nov 2026) by `switch-to-index-only`:** courses and home loans no longer store source data, so the stored-data, permission and legal-view parts of this change are not built. Read the new change first.

# Proposal

## Why

Iven decided on 20 Nov 2026 that domestic course coverage is every university whose courses are listed through VTAC, UAC or QTAC, not only the nine Victorian ones built so far. The roadmap parked this as Phase 6 (`add-nsw-course-data`, `add-qld-course-data`). This change replaces those two placeholders with one planned change that also fixes where the Victorian build assumed Victoria.

The Victorian build (`add-vic-course-data`, `add-vic-course-tools`, `add-vce-admissions-data`) hard-codes more than the data directory. A short audit (design, "What assumes Victoria") found: the YAML directory and dataset id, the government domain list, the one admissions-centre code field, the VCE-only study catalogue and prerequisite rules, the study-score unit, and the tool parameters and instructions text. Adding NSW, the ACT and Queensland is therefore a data model change plus content work, not only more YAML files.

## What Changes

- Extend the course index (CRICOS base, hand-filled gap rows, curated facts, `depth` of `index_only` or `curated`) to every university listed through UAC (NSW and the ACT) and QTAC (Queensland), beside VTAC (Victoria). Provider lists come from each university's own site and the CRICOS Institutions sheet; the admissions centres' participating-provider pages are read by hand and not copied.
- Generalise the model so a provider can sit in more than one state (for example a university with campuses in several states): one provider file, campuses carry their state, and each course says which admissions centre lists it and under what code.
- Replace the single `vtacCode` with a small list of admissions codes (`centre`: `vtac`, `uac`, `qtac`; `code`). The database column `vtac_code` stays readable; a migration adds the new table and backfills from it. Course ids stay as they are (`<provider>-cricos-<code>` and the gap-fill ids), and the `courses-domestic` vertical id stays.
- Add region folders under `data/courses/` (`vic/` exists; `nsw-act/` and `qld/` are new) and register one dataset per region (`vic-courses` unchanged, `nsw-act-courses`, `qld-courses`) so each region keeps its own rights entry and review date.
- Add the state-specific rules (design, "Scope by state"): HSC and ATAR terms for NSW and the ACT, QCE and selection rank terms for Queensland, their entry figure labels, and their subject catalogues. Subject-by-subject prerequisite checking for HSC and QCE is in scope but staged after the index and entry figures (see Phases in design).
- Retire the 97 pilot stand-in rows with a reviewed match (design, decision 6), not an automatic one.
- Record the decisions in `ROADMAP.md` (Phase 6) and `docs/course-gaps.md`.

Data sources: each university's own course pages and admissions transparency pages, re-keyed in our own words with a link; CRICOS (CC BY 2.5 AU) for the base index; the NSW Education Standards Authority (NESA) and QCAA public pages for subject lists and rules, quoted by link, not copied. No VTAC, UAC, QTAC, TISC or Course Seeker data is loaded.

Hosts affected: none directly; the existing course tools gain a region filter and answer for NSW, ACT and Queensland courses. The vertical stays on the internal route.

Out of scope:

- The pilot's `uac-nsw-courses.csv` and `qtac-qld-courses.csv`, any scraped data from UAC, QTAC or VTAC, and any "preferences" or "offers" data from them (the pilot files are scraped and lack ATARs and must never ship).
- Permission requests to VTAC, UAC or QTAC. The re-key strategy is the only route; no request is drafted or sent.
- ATAR calculation and subject scaling for NSW and Queensland. UAC and QTAC publish scaling and they are not open data. The tools say "not available" for them, as they do now for VCE scaling (`add-vce-admissions-data`).
- South Australia, the Northern Territory, Western Australia and Tasmania (SATAC, TISC, UTAS), non-university providers, and postgraduate courses.
- Public listing: the vertical stays internal-only until the gates in `docs/promotion-checklist.md` pass.

## Capabilities

### New Capabilities

- `state-course-data`: multi-state coverage of the course index (providers in several states, admissions centre codes, region datasets), the state-specific entry figure labels and subject catalogues, and the reviewed retirement of stand-in rows.

### Modified Capabilities

- `vic-course-data`, `vic-course-lookup`, `vce-planning`: not yet archived into `openspec/specs/`, so their changes are recorded as ADDED requirements on `state-course-data`; the apply phase reconciles the specs when the earlier changes are archived.

## Impact

- Code: `src/courses/{types,validate,load,studies,prerequisites,catalogue,instructions}.ts`, `src/tools/course-*.ts`, `src/core/rights.json`, a new migration under `src/energy/migrations/`.
- Data: `data/courses/nsw-act/`, `data/courses/qld/`, new subject catalogues.
- Docs: `docs/course-data.md`, `docs/areas/`, `ROADMAP.md`, `docs/course-gaps.md`.
- Effort: the main cost is curation by hand. The earlier study put national coverage at 6 to 12 months of content work; this change plans the model and the first slice, not the whole content set.
