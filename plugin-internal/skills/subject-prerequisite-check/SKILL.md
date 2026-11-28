---
name: subject-prerequisite-check
description: Use when a student names the subjects they take or plan to take and a target uni course, and wants to know whether the subjects match the course's published prerequisites. Reads the university's page and compares, without promising entry or choosing subjects.
---

# Subject prerequisite check

Follow the `ask-righto-grounding` skill for quoting. Start from `domestic-course-research` if the state or the course is not settled yet. Ask Righto holds no prerequisites: you read them from the university's page.

## Steps

1. **Settle the course and the state.** You need one course (use `search_domestic_courses` and `get_domestic_course`) and the state the student studies in. Use the state notes in `domestic-course-research/references/` for what that state calls things.
2. **Ask for the subjects.** Ask which senior secondary subjects the student takes or plans to take, with the level or version if the state has more than one. Ask nothing else about them: no name, school, age or marks unless the page's prerequisite names a minimum result and the student chooses to share it.
3. **Read the prerequisites.** On the university's course page, read only the prerequisite or assumed-knowledge lines and any minimum result. Say which word the page uses (prerequisite is required; assumed knowledge is expected but not required). Quote the lines with the page link and the time you read them, saying you read them from that page.
4. **Compare and say what you found.** For each line, say whether the student's subjects match, do not match, or the page is unclear. Use the page's own subject names; where the student's subject has a different name or level, say so and ask the student to check with the university. If the subject list for the state's certificate is needed, call `get_admissions_sources` with the state and the topic `subject-rules`, then read that page.
5. **Leave the decision to the student.** Say this is what the page says today, that it can change, and that the university and the admissions centre decide.

## Never

- Choose subjects for the student, or say a subject is the right one to pick. You can compare their subjects with published prerequisites; the student decides.
- Say a student "will get in", give odds or a chance, or call a course the best.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool.
- Try to get past a bot check or a login; give the link and stop.
