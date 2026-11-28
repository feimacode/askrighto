# Design

## Principles

- **Skills carry no data.** A reference file may say "NSW universities publish an ATAR and some publish a selection rank" (a structure fact with a source). It may not say any score, date or rule. Every reference file records the page it was read from and the date, and `checkedOn` follows the rule used for source links.
- **Every fact still traces to a page the agent read.** AGENTS.md rule 1: quote with link and time, label as read by the assistant, never send it back, never get past a bot check.
- **Do not guess the state.** The router asks once. A student's state of study decides the admissions centre, not their name, school or location, in the same spirit as the visa question.
- **Small skills, clear triggers.** Each skill has one job and a description that says when it applies. The router names the next skill; it does not duplicate it.

## Skill shape

| Skill | Trigger (description starts "Use when") | Tools it calls | Reads |
| --- | --- | --- | --- |
| domestic-course-research | a student or parent asks about uni courses, entry, VTAC, UAC, QTAC, ATAR, VCE, HSC or QCE | search_domestic_courses, get_domestic_course, get_admissions_sources | the course page |
| subject-prerequisite-check | the student names subjects and a course | get_domestic_course, get_admissions_sources (subject-rules) | course prerequisites, subject list |
| course-compare | two or more courses to compare | get_domestic_course | each course page |
| admissions-timeline | "when do I apply", dates, preferences, offers | get_admissions_sources (key-dates, preferences) | the dates page |
| entry-pathways | early entry, bonus or adjustment, pathway or diploma routes | get_admissions_sources (early-entry, adjustment-factors), get_domestic_course | university and centre pages |
| scaling-reader | scaling, aggregate, how a study counts | get_admissions_sources (scaling, atar-rules) | the scaling report or rule page |
| interstate-applicant | study in one state, apply in another, IB or overseas | get_admissions_sources | the centre's rules page |

## Reference files

`references/<system>.md` for VCE, HSC, the ACT certificate and QCE. Each has: the certificate and its authority, the admissions centre, the names the state uses for entry figures, where subject rules are published, and two or three traps (for example, subject names that differ between the certificate and a university page). They are our own wording, short, and checked against the official page before they ship. They are generated into nothing; a person reads them in review.

## What stays out

- No calculator tool. A skill may tell the agent to do the arithmetic a page defines and show its working. If we later want a deterministic aggregate calculator it is a tool change, decided in `generalise-admissions-sources`.
- No promise of entry, no odds, no "best", no eligibility judgement for early entry or adjustment schemes, no choosing subjects for the student.
- No new vertical or route change. The courses vertical stays internal.

## Testing

- Activation prompts per skill and per state, run by hand in Claude and ChatGPT, recorded in `docs/skills/activation-prompts.md` (the existing process; real hosts are untested).
- Eval prompts through the runner (`docs/use-case-comparison/prompts.md`) with `arg:get_admissions_sources.state=<state>` and `never:` checks for the banned wording.
- A unit test that every skill's `description` begins "Use when", that every tool a skill names exists, and that reference files contain no digit sequence that looks like a score or date (a coarse guard; a person reviews the rest).

## Decisions on the open questions (Iven, 28 Nov 2026)

- All seven skills in one build. Done.
- No aggregate calculator yet; no other states or IB.
- The router asks the state first when no university is named and offers the likely state when one is (recommendation taken).

## Risks and open questions

1. The reference files are the riskiest part: a wrong structure fact is a wrong claim. They need a person to open the official pages (the same step as `generalise-admissions-sources` task 1). Without that they ship as stubs that say "read the page".
2. Seven skills may be more than testers need first. Recommended order: router and prerequisite check first (the original product), then timeline and scaling reader, then compare, pathways and interstate. Build all behind one change or split?
3. Should `domestic-course-research` ask the state first, or infer it from the university the student names? Recommend ask first when no university is named, and infer from the course's `admissionsState` when one is.
4. Host behaviour is untested: whether Claude and ChatGPT load seven skills reliably and pick the right one. The activation prompts are the test.
