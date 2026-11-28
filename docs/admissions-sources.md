# Admissions sources (index-only)

Since 27 Nov 2026 (`switch-to-index-only`) Ask Righto stores no admissions data: no key dates, preference rules, early entry schemes, scaling tables or study groupings. Since 28 Nov 2026 (`generalise-admissions-sources`) the index covers four states, not only Victoria.

What exists is a table of official pages in `src/courses/sources.ts`, keyed by state, each with a reading checklist. The tool `get_admissions_sources` returns them for one state and, optionally, one topic.

| State | Admissions centre | Certificate | Subject rules published by |
| --- | --- | --- | --- |
| `vic` | VTAC | VCE | VCAA |
| `nsw` | UAC | HSC | NESA |
| `act` | UAC | ACT Senior Secondary Certificate | ACT Board of Senior Secondary Studies |
| `qld` | QTAC | QCE | QCAA |

Topics: `scaling` (the most recent report), `atar-rules`, `key-dates`, `preferences`, `early-entry`, `adjustment-factors` and `subject-rules`. The tool asks which state if none is given (`needs_input`); the state a student studies senior secondary in decides the system, not the university's state. Each result says that entry figures from different states are different measures and are never compared or converted, and that an aggregate is not an ATAR.

The assistant reads the page, quotes only the checklist items with the link and time read, labels them as read by the assistant, and never sends them back to the server.

**Status: partly confirmed.** On 28 Nov 2026 the device session opened every link. Entries pointing at an exact page it confirmed carry `checkedOn` (their checklist wording is still unchecked). Still unconfirmed: the VCAA, VTAC early-entry (no central page), QTAC early-entry (none central) and QCAA entries, which point at a home or search page; QCAA showed a bot check to a plain read. Corrections from that check: the VTAC scaling guide is by year of completing Year 12 (the old `/atar/scaling` page is dead), NESA now sits at nsw.gov.au (the syllabus site is curriculum.nsw.edu.au), and the ACT Board reports the ACT ATAR on its Tertiary Entrance Statement, not UAC. A person still confirms the checklist wording. `npm run sources:check` fetches each link (one a second, nothing kept) and counts entries with no `checkedOn`. Update the scaling entries each year when the centres publish a new report. Terms of use are in `data-rights.md` (`admissions-links`).

VTAC scaling and study groupings were `pending` permission and are now `withdrawn` in the rights register: they are linked, never stored.
