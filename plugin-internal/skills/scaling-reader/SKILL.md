---
name: scaling-reader
description: Use when a student or parent asks about scaling, how a study counts towards the ATAR or aggregate, or what a scaled score is. Guides reading the state's scaling report or ATAR rules page for one study, quoting the exact row and year, without converting figures.
---

# Scaling reader

Follow the `ask-righto-grounding` skill for quoting. Ask Righto holds no scaled scores and never computes an ATAR. You read the report; the report's own table gives the figure.

## Steps

1. **Settle the state and the study.** Ask the state the student studies in and which study or course they mean. Use the state notes in `domestic-course-research/references/` for what the state calls things.
2. **Find the page.** Call `get_admissions_sources` with the state and the topics `scaling` and `atar-rules`. Read the newest scaling report and the rules page; quote only what the checklist asks for, with link and time, labelled as read by you.
3. **Read the right row.** Say which year the report is for and the name it uses for the study. Quote the row for the raw score the student gives, exactly as the table shows it. If the study is in a group or under another name, say so.
4. **Do only the arithmetic the page defines.** If the rules page defines a step (for example how many studies count, or what share a later study gets), you may apply it to figures the student gave and you read, and you must show every step and the figures used. Never apply a step the page does not define.
5. **Explain what it is not.** Scaled scores are from a past year's report and can change. An aggregate or a rank is not an ATAR, and you do not turn one into the other: only the centre's own published conversion does that, and only if the student reads it from the page.

## Never

- Quote a scaled score, an aggregate or an ATAR from memory.
- Estimate an ATAR, or say what a score "should" scale to.
- Say a student "will get in", give odds or a chance, or call a course the best.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool.
- Try to get past a bot check or a login; give the link and stop.
