---
name: ask-righto-answer-review
description: Maintainer skill. Use to run a prompt set from docs/use-case-comparison against a host with the Ask Righto tools, check each answer for untraced figures and banned wording, and fill the scorecard. Not shipped to users.
---

# Ask Righto answer review

Repeats the hand protocol in `docs/use-case-comparison/protocol.md` so promotion gates and skill changes can be checked the same way each time.

## Steps

1. **Choose the set.** Domestic (D01 to D20) or international (I01 to I20) from `docs/use-case-comparison/prompts.md`. Say which host and whether a browsing assistant is on.
2. **Run each prompt.** Give the prompt to the host with the Ask Righto tools connected. Save, per prompt, a run file `{ "prompt", "toolResults": [every tool result text], "answer" }` under `docs/use-case-comparison/runs/<date>-<host>/<id>.json`. Do not edit the host's answer.
3. **Trace numbers.** Run `node scripts/trace-numbers.mjs <run file>`. Any `UNTRACED` figure is an ungrounded figure: record it, do not excuse it.
4. **Check wording.** Fail the prompt if the answer says best or recommended, gives odds of entry, converts an aggregate to an ATAR, or (international) gives visa advice. Check the expected tools in the prompt table were called.
5. **Fill the scorecard.** Copy the table in `docs/use-case-comparison/scorecard.md` into the run folder as `scorecard.md`: one row per prompt with pass or fail and the reason, then the summary table. Data-side measures come from `npm run compare:usecases`.
6. **Report.** Give counts (grounded share, ungrounded figures seen, not answerable) and the prompts that failed. Do not change thresholds; they are drafts in the protocol.

## Notes

- The number trace is deliberately strict: it flags any figure not in the prompt or a tool result, including rounded ones. Judge each flag by hand and say why it is or is not a problem.
- Run files hold host output only; they contain no user data.
