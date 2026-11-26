## Context

Victoria was built first and several parts assume it. The change must be honest about what is Victorian, what is generic and what needs new content. Findings below were read from the code on 20 Nov 2026 (`src/courses/*`, `src/tools/course-*.ts`, `data/`).

## What assumes Victoria

| Where | Assumption | Needed for NSW, ACT, QLD |
| --- | --- | --- |
| `src/courses/load.ts` (`join(dir, "courses", "vic")`), `src/tools/course-common.ts` (`COURSE_DATASETS = ["vic-courses"]`, repo link to `data/courses/vic`) | One data folder, one dataset | Read every region folder; one dataset per region |
| `src/courses/validate.ts` `GOV_DOMAINS` (`vcaa.vic.edu.au`), `TAC` list (`vtac.edu.au`, `courseseeker.edu.au`) | Only VCAA is an allowed government source; only VTAC and Course Seeker are blocked sources | Add `nesa.nsw.edu.au` and `qcaa.qld.edu.au` as allowed sources; add `uac.edu.au` and `qtac.edu.au` to the blocked list with rights entries |
| `Course.vtacCode`, `courses.vtac_code` | One admissions code | List of `{centre, code}` |
| `data/vce-studies.yaml`, `studies.ts`, `Leaf.study` with `minScore` | Subjects are VCE studies; the unit is a VCE study score (raw, out of about 50); English group and EAL variants | Subject catalogues per curriculum (`hsc`, `qce`) and a unit per curriculum (HSC band or mark; QCE result A to E) |
| `EntryFigure.kind` (`lowest_atar`, `lowest_selection_rank`, `guaranteed_atar`, `entry_threshold`, `median_atar`) | Labels follow what Victorian universities publish | Check what UAC-listed and QTAC-listed universities publish (adjustment factors, selection rank, ATAR) and add kinds only where a published figure does not fit; never reuse a label for a different thing |
| `src/courses/instructions.ts` and tool descriptions | "Victorian uni courses and VCE planning"; `vceStudies`, `estimate_vce_aggregate`, `get_vce_key_dates`, `list_early_entry_schemes` | Region filter and curriculum parameter; state-specific tools only where data exists |
| `data/vce/*.yaml` (key dates, preference rules, early entry) | VTAC dates and rules | Equivalent UAC and QTAC files, each marked `provisional` until re-read from the official page |
| CRICOS load (`--cricos`) | Providers present in the YAML decide which CRICOS rows enter the index | No change in logic: adding provider files brings their CRICOS courses in |

Everything else (courses and campuses tables, curated figure and prerequisite tables, `origin`/`depth`, the loader, page checker, verbatim check, notice wording, rights register, release checks) is generic and stays.

## Scope by state

NSW and the ACT (UAC): the Higher School Certificate and the ATAR. Universities publish a lowest ATAR or selection rank for a course, often with adjustment factors (bonus points) and guaranteed schemes. Subject requirements are HSC courses (with the NESA course names) and an assumed-knowledge level, which universities word as "prerequisite", "assumed knowledge" or "recommended". The existing structured rule is all-of / any-of over a subject with a minimum score; HSC needs a minimum band or mark and a flag for assumed knowledge versus prerequisite. ACT students mostly sit the ACT Senior Secondary Certificate and are ranked in the ATAR, but coverage of ACT school subjects is out of scope here; the index covers the ACT universities, with entry facts as the university states them.

Queensland (QTAC): the QCE and the ATAR (Queensland moved to an ATAR in 2020) with a selection rank. Subject prerequisites are QCAA subjects with a minimum result (for example a C in a named subject) and sometimes "general subjects only". The rule structure is the same, with a grade unit instead of a score.

Not planned: Victoria-style aggregates, scaling and study groupings for either state (see Out of scope in the proposal). The ATAR is the single national rank; a tool never converts one state's figures into another's.

## Decisions

1. **One folder per region, one provider file per university.** `data/courses/vic/`, `nsw-act/`, `qld/`. A university in several states lives in its head-office region's folder; its campuses carry their state and each course names the admissions centres that list it. This keeps provider ids and course ids unchanged and avoids duplicate rows.
2. **Admissions codes become a list.** `admissions: [{centre: vtac|uac|qtac, code}]` on a course. Migration adds `course_admissions` and backfills from `vtac_code`; `vtac_code` stays until the apply phase removes its readers. Course ids and the `courses-domestic` id do not change.
3. **Datasets per region, same rights approach.** `nsw-act-courses` and `qld-courses` are added to the rights register as `own_words_facts` with the status `cleared_pending_legal_view`, the same state as `vic-courses`, and the same review-by routine. No permission request is made to any admissions centre. UAC and QTAC get blocked-source entries like VTAC.
4. **Curricula become data.** `data/hsc-courses.yaml` and `data/qce-subjects.yaml` hold the subject names (ids are ours, names from the NESA and QCAA lists) beside `data/vce-studies.yaml`. A rule's `study` id belongs to one curriculum; the validator checks the curriculum matches the course's region rule set. Score unit is a field of the curriculum, not a hard-coded 0 to 50 range.
5. **Phases inside this change.** (A) model, validator, loader, region folders, rights entries, CRICOS index for the new providers, official links; (B) entry figures and curated facts for the first universities in each state, plus the state-specific key dates and early entry notes; (C) HSC and QCE prerequisite rules and tool support. A can ship without C: an index-only or entry-figure-only answer is honest and labelled. Question to Iven below if C should move to its own change.
6. **Retiring the 97 stand-in rows: reviewed match, hand-set code.** The 97 pilot stand-ins have no CRICOS code. In the 21 Nov 2026 load, 50 of them have an exact name match inside the same provider, but many names map to several CRICOS codes (for example Bachelor of Arts at Deakin, Bachelor of Science at Federation, and a 2-code Bachelor of Nursing), so an automatic link would sometimes pick the wrong course. Plan: add `courses:match-standins`, a read-only report that proposes matches by normalised name and provider and lists the candidates; a person sets `cricosCode` on the stand-in in YAML after checking the campus and year; the loader then replaces the stand-in with the CRICOS row and keeps its curated facts. A stand-in with no match stays `gap_fill` because it may be a genuine domestic-only course. The loader never links by name on its own.
7. **Content order.** Start where browsing agents fail: universities whose pages could not be read in the 16 Nov test, then the most-asked courses. First slice: a small, named set per state, listed in task 3.1 once confirmed by Iven. Launch depth stays the question Iven decided as "all universities"; the planned depth per university (index only, or index plus curated entries) is a content decision made in task 3.1, since "cover all" can be met by the index with links and curated depth for the most-asked courses.
8. **Rights and terms.** Re-read the UAC, QTAC, NESA, QCAA and university terms pages before curating (the register has `reviewBy`); record the read dates. Any university whose terms bar summarising stays index-only with links.

## Risks / Trade-offs

- Scale: many more universities and courses; mitigated by the index/depth split and the staged phases.
- Rule semantics differ by state; mitigated by curriculum-specific catalogues and by never converting between systems.
- Provider overlap across states could duplicate rows; mitigated by one provider file and a validator rule that a provider id appears once.
- Name matching for stand-ins could mislead; mitigated by decision 6.

## Open Questions

- Move phase C (HSC and QCE prerequisite checking) into its own change after A and B ship? Recommended default: no, keep it here but ship A and B first.
- Do ACT universities go in the `nsw-act` folder (UAC lists them) or their own folder? Default: `nsw-act`.
- Which universities per state are curated first (task 3.1)? Needs Iven's list or a rule such as "universities whose pages block browsing agents".
