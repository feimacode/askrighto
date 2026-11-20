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
| Domestic CRICOS load done on `askrighto_dev` 21 Nov 2026 (1,183 courses: 1,086 CRICOS, 97 stand-ins, 1 curated; no warnings); stand-ins not yet retired | domestic | Retire stand-ins by reviewed match (see decisions below) |
| 1 Oct 2026 CRICOS data loaded on `askrighto_dev` 21 Nov 2026 (13,069 courses, 20,087 locations, 664 providers); reload needed after the level change | international | Reload when `add-intl-diplomas-vet` is built |
| Entry figures, prerequisites, summaries: only RMIT Engineering curated | domestic | Curate by hand from official pages, starting where browsing fails (Melbourne, ACU, La Trobe) |
| Key dates, preference rules, early-entry schemes provisional, not re-read | domestic | Re-read VCAA and VTAC pages, reword, clear `provisional` |
| `vce-studies.yaml` has empty VCAA study `codes` | domestic | Fill from the VCAA study list |
| Guided-browsing checklist untested on real university and provider sites | both | Run in Claude in Chrome and ChatGPT |
| 20-prompt runs per use case, scorecard | both | Run after the loads above (`add-course-use-case-comparison` 4.1) |

## Not built yet (no decision needed)
- `courses:gap-report` (published course lists vs our index). It needs each university's course list, so build it with the first real load.
- Page checker has not been run against live pages.

## Decided 20 Nov 2026 (Iven)
1. **Domestic coverage:** all universities listed through VTAC, UAC and QTAC (Victoria, NSW and the ACT, Queensland), not only the nine Victorian ones. Planned in `openspec/changes/extend-courses-to-uac-qtac` (model changes, state rules, staged phases). Still open inside it: which universities and courses get curated depth first, and whether HSC and QCE prerequisite checking becomes its own change.
2. **International levels:** diplomas, advanced diplomas and VET (Certificate I to IV) are included, which adds 10,343 courses (5,846 diplomas and advanced diplomas plus 4,497 certificates) to the 13,069 loaded. Non AQF Award, Vocational Short Course and school levels stay out. Planned in `openspec/changes/add-intl-diplomas-vet`.
3. **Pilot stand-ins (97 rows):** retire by reviewed match with a hand-set `cricosCode`, not by automatic link (50 have an exact name match in the same provider, but several names map to more than one CRICOS code). A report command proposes matches; planned in `extend-courses-to-uac-qtac`.
4. **Permissions:** none requested from VTAC, UAC or QTAC; re-key strategy only.

## Blocked on outside parties
- VTAC scaling and study groupings, and the UAC and QTAC equivalents (permission requests not sent, by Iven's decision to use re-keying only).
- Legal view on the four own-words datasets (`cleared_pending_legal_view`).
- Terms pages re-read before the first release (`add-course-data-permissions` 4.3, `add-vic-course-data` 5.1).
