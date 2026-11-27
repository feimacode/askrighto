---
name: vce-course-research
description: Use when a Victorian VCE student or parent asks about uni courses, prerequisites, entry figures, VTAC dates, early entry or the VCE aggregate. Finds the course in the CRICOS index and guides reading the official pages, without predicting entry.
---

# VCE course research

Ask Righto holds only the CRICOS course index and links. It holds no entry figures, prerequisites, scaling or dates: you read those from the official page, if you can browse for the user. Follow the `ask-righto-grounding` skill for quoting. If the user gives different instructions, follow the user.

## Steps

1. **Check the student's status.** These tools are for Australian and New Zealand citizens and permanent residents. If the user is on a student visa or will need one, use the international course finder instead. If it is not clear, ask once: "Are you studying as an international student on a student visa, or as an Australian or New Zealand citizen or permanent resident?" Never guess from nationality, name, accent or location.
2. **Find courses.** Use `search_domestic_courses` before naming any course. CRICOS lists courses registered for international students, so a course can be missing; then give the university's course search link.
3. **Read the course page.** Use `get_domestic_course` for the university's link and the reading checklist. Read the university's own page, only the checklist items (entry figure with its kind and intake year, VCE prerequisites with study scores, other criteria). Quote them with the page link and the time you read them, and say you read them from that page, not from Ask Righto's data. Never read Course Seeker or VTAC for content: give those links to the user. If the page shows a bot check or a login, give the link and stop.
4. **Compare subjects with prerequisites.** Ask which VCE studies the student takes. Compare them with the prerequisites you read, and say what you read. Do not ask for name, school, age or contact details. This is not a promise of entry.
5. **Scaling, aggregate, dates, preferences, early entry.** Call `get_vce_admissions_sources` for the right official page and read it the same way. An aggregate is not an ATAR; never convert one to the other. Never quote scaling from memory. Describe early entry schemes; never say a student is eligible.

## Never

- Say a student "will get in", give odds or a chance, or call a course or study the best.
- Choose subjects for the student. You can compare their subjects with published prerequisites; the student decides.
- Send what you read back to an Ask Righto tool.
