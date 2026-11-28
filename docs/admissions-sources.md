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

**Status: unconfirmed.** Only the Victorian pages were indexed from earlier repo notes; the NSW, ACT and Queensland pages and the state-to-centre table were written on 28 Nov 2026 without access to the sites, and many point at the centre's home page and say where to look. No entry has a `checkedOn` date, so every result carries a warning. A person opens each page, corrects the table and sets `checkedOn` (`generalise-admissions-sources`, task 1). `npm run sources:check` fetches each link (one a second, nothing kept) and counts entries with no `checkedOn`. Update the scaling entries each year when the centres publish a new report. UAC and QTAC terms have not been read (see `data-rights.md`, `admissions-links`).

VTAC scaling and study groupings were `pending` permission and are now `withdrawn` in the rights register: they are linked, never stored.
