# Course tools

Three read-only tools, served on the internal route only until promotion. They are index-only: Ask Righto holds the CRICOS course index and links, and no entry figures, prerequisites, scaling or dates. Every course result carries the notice that Ask Righto has not read the university's page, and that anything the assistant reads there is past or published information, not a cut-off or a prediction.

| Tool | Use |
| --- | --- |
| `search_domestic_courses` | Find CRICOS index rows by name, university, campus and region (`vic`, `nsw-act`, `qld`). Returns code, campuses, duration and the university's course link. A course may be missing: CRICOS lists courses registered for international students. |
| `get_domestic_course` | One index row, the university's link, a reading checklist (entry figure with kind and year, subject prerequisites with any minimum result, other criteria), the admissions state hint (`admissionsStates`) and browsing rules. Course Seeker and admissions centre links are for the user only. |
| `get_admissions_sources` | Official pages to read for one state (`vic`, `nsw`, `act` or `qld`): scaling, ATAR rules, key dates, preferences, early entry, adjustment schemes and subject rules, each with a reading checklist. Asks which state if none is given. Links only; never compares or converts figures between states. |

Removed on 27 Nov 2026: `compare_domestic_courses`, `check_domestic_course_prerequisites`, `get_subject_scaling`, `estimate_vce_aggregate`, `get_vce_key_dates`, `list_early_entry_schemes`.

## Example prompts

- "Which nursing degrees are in the index?" (`search_domestic_courses`)
- "What do I read to find the entry requirement for that course?" (`get_domestic_course`, then the host reads the university page)
- "Where do I find the latest scaling report for NSW?" (`get_admissions_sources`, with the state)

The host reads the university page first, quotes only the checklist items with the link and time read, says they were read by the assistant and not from Ask Righto's data, and gives the link instead if it meets a bot check.

## Privacy

No tool asks for a name, school, age or contact details. Nothing is stored and the access log never holds arguments.
