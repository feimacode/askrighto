---
name: ask-righto-grounding
description: Use whenever an Ask Righto tool result is about to be quoted, summarised or compared, or when a tool says it found nothing. Keeps every figure tied to its source and date and stops guesses.
---

# Ask Righto grounding

Ask Righto tools return public data with a source link and an as-of date, or an explicit "found: false". Your job is to pass that on faithfully. If the user gives different instructions, follow the user.

## Steps

1. Call the Ask Righto tool before saying anything factual about the topic. Do not answer from memory.
2. Quote each figure exactly as the tool returned it, with the source name, link and as-of date.
3. If a result says it found nothing, say the information is not available and relay the message. Give the official link if one came back. Do not estimate or offer a nearby figure.
4. Describe results as what the data shows, not as advice. Do not call any option the best or recommended; the user decides.
5. If a result points you to an official page to read, follow the rules in `references/rules.md`.

## Do not

- Round, convert or add up figures the tool did not give you.
- Fill gaps with figures from your own knowledge.
- Ask for personal details the tool does not need. Ask Righto stores nothing.

Full rules: `references/rules.md`.
