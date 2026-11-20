# Course data gaps (domestic and international)

Status as of 20 Nov 2026, from reading `docs/areas/vic-courses.md`, `docs/areas/international-courses.md`
and the unticked tasks of the course OpenSpec changes. Both verticals stay internal-only until the gates in
`promotion-checklist.md` pass.

## Closed in this change
- Domestic `courses:load` now takes `--course-locations`, so CRICOS-origin rows get campuses (the real file keeps them on a separate sheet).
- `courses:check-pages` now reports 12-word verbatim runs against the official page and flags pages with little text.

## Needs a machine that reaches data.gov.au, the database or university pages (the WSL)
| Gap | Vertical | Next step |
| --- | --- | --- |
| No real CRICOS load of the domestic index; 97 of 98 rows are pilot stand-ins | domestic | Export Courses and Course Locations sheets to CSV, run `courses:load --cricos ... --course-locations ...` against `askrighto_dev`, read the report, retire stand-ins that match |
| Not confirmed that the 1 Oct 2026 CRICOS data is loaded in any database | international | Run `intl:load` with the three CSVs and `--source-date 2026-10-01` on `askrighto_dev` |
| Entry figures, prerequisites, summaries: only RMIT Engineering curated | domestic | Curate by hand from official pages, starting where browsing fails (Melbourne, ACU, La Trobe) |
| Key dates, preference rules, early-entry schemes provisional, not re-read | domestic | Re-read VCAA and VTAC pages, reword, clear `provisional` |
| `vce-studies.yaml` has empty VCAA study `codes` | domestic | Fill from the VCAA study list |
| Guided-browsing checklist untested on real university and provider sites | both | Run in Claude in Chrome and ChatGPT |
| 20-prompt runs per use case, scorecard | both | Run after the loads above (`add-course-use-case-comparison` 4.1) |

## Not built yet (no decision needed)
- `courses:gap-report` (published course lists vs our index). It needs each university's course list, so build it with the first real load.
- Page checker has not been run against live pages.

## Needs Iven's decision
1. Launch curation depth for domestic courses (how many universities and courses to hand-curate before any promotion).
2. Whether the international vertical includes diplomas and VET (5,846 more courses in the 1 Oct file; one function, `levelGroupOf`, changes).

## Blocked on outside parties
- VTAC scaling and study groupings (permission requests not sent, by Iven's decision to start with re-keying).
- Legal view on the four own-words datasets (`cleared_pending_legal_view`).
- Terms pages re-read before the first release (`add-course-data-permissions` 4.3, `add-vic-course-data` 5.1).
