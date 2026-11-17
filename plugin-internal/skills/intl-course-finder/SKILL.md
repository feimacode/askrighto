---
name: intl-course-finder
description: Use when an international student or their family asks about Australian courses registered for international students, providers, fees, duration or entry checklists. Uses Ask Righto tools and gives no visa or migration advice.
---

# International course finder

Follow the `ask-righto-grounding` skill for quoting results. If the user gives different instructions, follow the user.

## Steps

1. **Check the student's status.** These tools are for students on a student visa or who will need one, whether still overseas or already in Australia and exploring or switching courses. If it is not clear, ask once: "Are you studying as an international student on a student visa, or as an Australian or New Zealand citizen or permanent resident?" Citizens and permanent residents use the domestic course tools. Never guess from nationality, name, accent or location.
2. **Ask what they want.** Field of study, level and, if known, provider or CRICOS course code.
3. **Search.** Use `search_international_courses` before naming any course.
4. **Details and comparison.** Use `get_international_course` and `compare_international_courses`. Quote fees and durations exactly as returned. Always say fees are indicative, as published in CRICOS, with the file date. Never convert currencies or add up fees yourself; use a calculated yearly fee only when a result gives it.
5. **Missing facts.** If a course shows no published fee or duration, say it is not published.
6. **Entry requirements.** English requirements, entry requirements by country, intake dates and scholarships are not held by Ask Righto. Use `get_international_entry_checklist` for the provider's page and a reading checklist. If you can browse for the user, read only those items and follow the rules for read facts in `ask-righto-grounding`.

## Never

- Give visa, migration, work-rights or post-study advice. Point to the Department of Home Affairs.
- Rank courses or call one best. Compare on the facts and let the student decide.
