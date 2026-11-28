# University courses and admissions planning (vertical `courses-domestic`)

Rewritten 27 Nov 2026 for `switch-to-index-only`. The earlier version described the curated YAML store, the prerequisite evaluator, the aggregate calculator and eight tools; all of that was removed. See platform.md for the shared pieces.

## What it holds

- The CRICOS course index (CC BY 2.5 AU) for each university with a provider file in `data/courses/<region>/`: table `courses`, `course_campuses`, `providers`, `cricos_raw`, `course_loads`.
- Links and reading checklists in `src/courses/sources.ts` for Victoria, NSW, the ACT and Queensland (scaling report, ATAR rules, key dates, preferences, early entry, adjustment schemes, subject rules; see [admissions-sources.md](../admissions-sources.md)) and the provider links in the YAML.
- Nothing else: no entry figures, prerequisites, scaling, dates or rules.

## Tools (internal route only)

`search_domestic_courses`, `get_domestic_course`, `get_admissions_sources` (see [course-tools.md](../course-tools.md)). The vertical flag is still `courses-domestic`; the public route serves energy only.

## Commands

| Command | Does |
| --- | --- |
| `courses:validate` | checks the provider files in `data/courses/` |
| `courses:load [--cricos FILE.csv]` | builds the CRICOS index and loads it in one transaction |
| `cricos:refresh` | fetches CRICOS from data.gov.au and loads the domestic index and the international store |
| `sources:check` | fetches each indexed link once a second and reports failures; keeps nothing |

## How an answer is made

The server returns an index row, the university's link and a reading checklist. The user's assistant, if it can browse, reads the university page, quotes the checklist items with the link and time read, labels them as read by the assistant and never sends them back (AGENTS.md rule 1). Course Seeker and VTAC are links for the user only. If the page shows a bot check the assistant gives the link and stops.

## Limits

- CRICOS lists courses registered for international students, so a domestic-only course may be absent; the tool then returns the university's search link.
- Whether the real CRICOS file gives the 1,183 domestic rows seen on 20 Nov is checked on each refresh.
- The VCE source links are unconfirmed until a person opens each one.
- HSC and QCE have no guidance; NSW, ACT and Queensland courses get the index and links only.
