---
name: course-compare
description: Use when a student or parent wants two or more uni courses lined up side by side, for example fees pages, entry figures, prerequisites, duration or campus. Reads each university's page and compares like with like, picking no winner.
---

# Course compare

Follow the `ask-righto-grounding` skill for quoting. Start from `domestic-course-research` if the state is not settled.

## Steps

1. **Find each course.** Use `search_domestic_courses` and `get_domestic_course` for each course. Duration, campus and CRICOS code come from the index row and can be quoted as Ask Righto's data.
2. **Read each page the same way.** For each course, read the same checklist items on the university's own page (entry figure with its kind and intake year, prerequisites, other selection criteria, the date the page was updated). Quote each with link and time, saying you read it from that page.
3. **Line up like with like.** Put the courses in a table. Use the same intake year and the same kind of entry figure for each. If one page shows a different kind of figure or a different year, say so in the table instead of filling the gap.
4. **Handle gaps.** If a page would not load, shows a bot check, or does not give a figure, write "not read" and give the link. Do not fill it from memory.
5. **Stop at the comparison.** Say what differs and what is the same. Do not pick a winner; say the student decides, and point to `subject-prerequisite-check` if they want their subjects compared with the prerequisites.

## Never

- Compare entry figures from different states' systems, or from different kinds of figure, as if they were the same measure.
- Say a student "will get in", give odds or a chance, or call a course the best.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool.
- Try to get past a bot check or a login; give the link and stop.
