---
name: domestic-course-research
description: Use when an Australian or New Zealand student or parent asks about uni courses, entry, prerequisites, ATAR, VCE, HSC or QCE, VTAC, UAC or QTAC, in Victoria, NSW, the ACT or Queensland. Finds the course in the CRICOS index and guides reading the official pages, without predicting entry.
---

# Domestic course research

Ask Righto holds only the CRICOS course index and links. It holds no entry figures, prerequisites, scaling or dates: you read those from the official page, if you can browse for the user. Follow the `ask-righto-grounding` skill for quoting. If the user gives different instructions, follow the user.

This skill is the starting point. It hands off to `subject-prerequisite-check`, `course-compare`, `admissions-timeline`, `entry-pathways`, `scaling-reader` and `interstate-applicant` when the question fits one of them.

## Steps

1. **Check the student's status.** These tools are for Australian and New Zealand citizens and permanent residents. If the user is on a student visa or will need one, use the international course finder instead. If it is not clear, ask once: "Are you studying as an international student on a student visa, or as an Australian or New Zealand citizen or permanent resident?" Never guess from nationality, name, accent or location.
2. **Ask the state, once.** Ask which state the student studies (or studied) senior secondary in: Victoria (VCE, applications through VTAC), NSW (HSC, UAC), the ACT (the ACT Senior Secondary Certificate, UAC) or Queensland (QCE, QTAC). The state of study decides the admissions system, not where the university is or where the family lives now. If they study something else (the IB, an overseas certificate, a different state), use `interstate-applicant`. If a university is already named and `get_domestic_course` returns `admissionsStates`, offer that as the likely answer and confirm it. Then read the matching file in `references/` for the names that state uses.
3. **Find courses.** Use `search_domestic_courses` before naming any course. CRICOS lists courses registered for international students, so a course can be missing; then give the university's course search link.
4. **Read the course page.** Use `get_domestic_course` for the university's link and the reading checklist. Read the university's own page, only the checklist items, and quote them with the page link and the time you read them, saying you read them from that page, not from Ask Righto's data. Never read Course Seeker, VTAC, UAC or QTAC for a university's course content: give those links to the user. If the page shows a bot check or a login, give the link and stop.
5. **Hand off.** Subjects against prerequisites: `subject-prerequisite-check`. Two or more courses: `course-compare`. Dates and steps: `admissions-timeline`. Early entry, bonus or adjustment schemes, pathway courses: `entry-pathways`. Scaling or how a study counts: `scaling-reader`. Anything that needs the official admissions pages: call `get_admissions_sources` with the student's state and read the page the same way.

## Never

- Say a student "will get in", give odds or a chance, or call a course or study the best.
- Choose subjects for the student. You can compare their subjects with published prerequisites; the student decides.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool, or ask for name, school, age or contact details.
- Try to get past a bot check or a login.
