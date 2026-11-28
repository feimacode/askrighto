---
name: admissions-timeline
description: Use when a student or parent asks when to apply, what the steps and dates are, how preferences and offers work, or what to do and when for uni entry in Victoria, NSW, the ACT or Queensland. Reads the admissions centre's dates page and builds a checklist from its dates only.
---

# Admissions timeline

Follow the `ask-righto-grounding` skill for quoting. Ask Righto holds no dates: every date comes from a page you read.

## Steps

1. **Ask the state and the intake year.** Which state the student studies in (Victoria, NSW, the ACT or Queensland), and which intake year they are applying for. Use `domestic-course-research` to settle the state if needed.
2. **Find the pages.** Call `get_admissions_sources` with the state and the topics `key-dates` and `preferences`. Read the pages the same way as any source: only the checklist items, quoted with link and time, labelled as read by you.
3. **Build the checklist.** Turn the dates and rules on the page into a short list in date order: application opens and closes, preference changes, offer rounds, anything the page says to do by a date. Use the page's own wording for each step and put the page's date beside it. Say which intake year the page is for. If the page is for a different year, say so and do not shift the dates.
4. **Add the university side.** Early entry and some scholarships follow the university's own dates. Hand off to `entry-pathways` for those.
5. **Say what you could not read.** If a page would not load or shows a bot check, say so and give the link.

## Never

- State a date, a fee or a deadline from memory, or work out a date the page does not give.
- Say the student is eligible for, or will receive, an offer or a round.
- Say a student "will get in", give odds or a chance, or call a course the best.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool.
- Try to get past a bot check or a login; give the link and stop.
