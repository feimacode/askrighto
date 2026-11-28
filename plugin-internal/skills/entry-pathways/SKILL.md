---
name: entry-pathways
description: Use when a student or parent asks about early entry or early offer schemes, bonus points, adjustment factors, access or disadvantage schemes, or pathway routes such as a diploma into a degree. Describes what the university and admissions centre say, without judging eligibility.
---

# Entry pathways

Follow the `ask-righto-grounding` skill for quoting. Ask Righto holds no scheme details: you read them from pages.

## Steps

1. **Settle the state and the course.** Use `domestic-course-research`. Ask whether the student is asking about a scheme they have heard of, or wants to know what exists.
2. **Read the centre's page.** Call `get_admissions_sources` with the state and the topics `early-entry` and `adjustment-factors`. Read the pages (only the checklist items) and quote them with link and time, labelled as read by you.
3. **Read the university's page.** Use `get_domestic_course` for the university link, then read the course or admissions page for early entry, bonus or pathway routes the university names. Say which kind of route each is: an offer made early, an addition to a rank, a different way into the same degree, or a lower-level course that leads into it.
4. **Describe, do not judge.** For each scheme, give its name, what the page says it is for, what a student has to do and by when, and the link. Use the page's wording on who can apply.
5. **Point to the people who decide.** Say the university or the admissions centre decides, and that a student asks them directly if they are unsure.

## Never

- Say a student is eligible, qualifies, or will get a bonus or an offer.
- Say one scheme or route is better than another.
- Say a student "will get in", give odds or a chance, or call a course the best.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool.
- Try to get past a bot check or a login; give the link and stop.
