# Course tools

Eight read-only tools, served on the internal route only until promotion. Every course result carries the notice "Past entry figures are not cut-offs or predictions. Prerequisites are as published for the year shown. Check the official course page before deciding. General information, not advice." and states its depth.

| Tool | Use |
| --- | --- |
| `search_domestic_courses` | Find courses by name, field, university, campus; optionally filter by the student's studies (scores ignored) or by latest lowest selection rank. |
| `get_domestic_course` | One course in full, or links and a reading checklist if it is index-only. |
| `compare_domestic_courses` | Two to five courses side by side; no winner. |
| `check_domestic_course_prerequisites` | Up to ten courses against the student's studies (and scores): met, not_met, needs_scores, cannot_check. |
| `get_subject_scaling`, `estimate_vce_aggregate` | Scaled scores and an aggregate from expected study scores. `data_unavailable` in production until VTAC's permission is recorded. |
| `get_vce_key_dates`, `list_early_entry_schemes` | Dates and early offer schemes, with links and no eligibility verdict. |

## Example prompts

- "Which engineering courses at RMIT are held, and what was the latest lowest selection rank?" (`search_domestic_courses`)
- "Compare these three nursing degrees." (`compare_domestic_courses`)
- "I do English, Chemistry and Biology. Which of these courses do my subjects rule out?" (`check_domestic_course_prerequisites`)
- "If I get 35 in Chemistry and 30 in English, what is my aggregate?" (`estimate_vce_aggregate`, development only)
- "When do VTAC preferences close?" (`get_vce_key_dates`)
- "Which universities have early offers?" (`list_early_entry_schemes`)
- Index-only course with a browsing assistant: "Open the official page for that course and read the entry figure and prerequisites." The host should read the university page first, then Course Seeker, never VTAC, quote only the checklist items with the link and time read, and say they were read by the assistant, not Ask Righto.

## Privacy

No tool asks for a name, school, age or contact details. Studies and scores are inputs to one call; nothing is stored and the access log never holds arguments.
