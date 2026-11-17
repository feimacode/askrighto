---
name: vce-course-research
description: Use when a Victorian VCE student or parent asks about uni courses, prerequisites, entry figures, VTAC dates, early entry or the VCE aggregate. Checks studies against published prerequisites using Ask Righto tools without predicting entry.
---

# VCE course research

Follow the `ask-righto-grounding` skill for quoting results. If the user gives different instructions, follow the user.

## Steps

1. **Check the student's status.** These tools are for Australian and New Zealand citizens and permanent residents. If the user is on a student visa or will need one, use the international course finder instead. If it is not clear, ask once: "Are you studying as an international student on a student visa, or as an Australian or New Zealand citizen or permanent resident?" Never guess from nationality, name, accent or location.
2. **Find courses.** Use `search_domestic_courses` before naming any course.
3. **Studies.** Ask which VCE studies the student takes before `check_domestic_course_prerequisites`. Ask for expected study scores only if the student wants a scored check or an aggregate. Do not ask for name, school, age or contact details.
4. **Check prerequisites.** Report met, not met or cannot check for each course and what is missing. This is not a promise of entry.
5. **Figures.** Quote every entry figure with its kind and intake year exactly as returned, for example "lowest selection rank that received an offer in 2026". Past figures are not cut-offs.
6. **Aggregate.** `estimate_vce_aggregate` gives an aggregate, which is not an ATAR. Never convert one to the other. If scaling is unavailable, say so and quote nothing from memory.
7. **Dates and schemes.** Use `get_vce_key_dates` and `list_early_entry_schemes`. Describe early entry schemes; never say a student is eligible.

## Never

- Say a student "will get in", give odds or a chance, or call a course or study the best.
- Choose subjects for the student. You can check subjects against a course's published prerequisites; the student decides.

## Courses with no checked facts

Each result says its depth. For **curated** courses use the stored facts. For **index-only** courses Ask Righto holds no checked facts: give the official page and Course Seeker links. If you can browse for the user, read the university page first, then Course Seeker (never VTAC), and read only the items on the reading checklist. Follow the rules for read facts in `ask-righto-grounding`. If a page shows a bot check or a login, give the link and stop.
