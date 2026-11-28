# Proposal

## Why

The only domestic course skill is `vce-course-research` (internal plugin). It is named for Victoria, covers one flow (find a course, read its page, compare the student's subjects with prerequisites, point at the admissions pages), and says nothing for a student in NSW, the ACT or Queensland. Skills are where multi-turn intake and wording live (`add-host-guidance`), and they carry no data, so they are the cheap way to give the agent more capability under the index-only approach (`switch-to-index-only`): the agent fetches, the skill tells it how to look and how to say it.

Iven asked on 28 Nov 2026 to extend the skills to give the agent more capabilities, and noted that a VCE-only name is wrong once more states are included. This change pairs with `generalise-admissions-sources`, which makes the tool and source index state-neutral. The skills depend on that tool.

## What Changes

New or changed skills in `plugin-internal/skills/` (internal testers only; the public plugin stays energy):

1. **`domestic-course-research`** (replaces `vce-course-research`): the router. Asks the student's status (visa or citizen or permanent resident), the state they study in and the certificate (VCE, HSC, the ACT certificate, QCE, or something else such as the IB or interstate), then finds courses, reads the page, and hands off to the skills below. Reference files per system under `references/` (`vce.md`, `hsc.md`, `act.md`, `qce.md`) hold structure facts only: what the entry figures and bodies are called, where the subject rules live, what the usual traps are. No numbers, dates or rules.
2. **`subject-prerequisite-check`**: given a target course and the student's subjects, read the course page's prerequisites, line them up with the student's subjects under that state's naming (units 3 and 4 in the VCE, courses in the HSC, subjects in the QCE), say what the page says, and flag anything the page leaves unclear. Never promises entry; the student decides.
3. **`course-compare`**: two or more courses side by side from pages the agent read, with the same intake year and the same kind of entry figure, each figure quoted with link and time. Declines to pick a winner and to compare figures from different states' systems.
4. **`admissions-timeline`**: reads the state's key dates page and gives the student a dated checklist (application, preference changes, offer rounds), using only dates on the page, relative to the page's intake year. Never states a date from memory.
5. **`entry-pathways`**: describes early entry, adjustment or bonus schemes and alternative pathways (for example a pathway diploma) as the university and the admissions centre describe them, with links. Never says a student is eligible.
6. **`scaling-reader`**: guides the agent through reading the state's scaling report or aggregate rule for one study, quoting the exact row and the year. The agent does only arithmetic the page defines and shows it. An aggregate is not an ATAR; never converts one to the other.
7. **`interstate-applicant`**: a student who studies in one state and applies in another, or does the IB or an overseas certificate. Explains in general terms which admissions centre and rules apply and where to read them; never compares figures across systems.

Also:

- Update `COURSE_INSTRUCTIONS` so the server text and the skills agree, and add the new skills' activation prompts to `docs/skills/activation-prompts.md`.
- Extend the eval set (`docs/use-case-comparison/prompts.md`) with NSW, ACT and Queensland prompts for each new skill, with `arg:` and `says:` checks.
- Add the skills to the internal plugin bundle and `plugin:check`; the public plugin is unchanged.

Out of scope: any new tool or stored data (the aggregate calculator is a question in `generalise-admissions-sources`); the public listing of courses; South Australia, Western Australia, Tasmania and the Northern Territory; a custom agent (skills only, `skills-plan`); Claude in Chrome page-reading agents.

## Impact

- `plugin-internal/skills/` (one renamed skill, six new, reference files), `src/courses/instructions.ts`, `docs/skills/activation-prompts.md`, `docs/areas/skills-and-plugins.md`, `docs/use-case-comparison/prompts.md`, `scripts/plugin.mjs` outputs.
- Depends on `generalise-admissions-sources` for `get_admissions_sources`.
