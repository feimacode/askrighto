## Why

The health cover tools need careful intake and strict wording that server instructions alone cannot hold across a multi-turn chat: ask household, state and cover type before searching; keep income and age out of any stored place; never ask for medical conditions; never say "best" or "you should"; present the surcharge test as two figures, not an instruction; state that the insurer's quote governs; and handle a proposed rebate change as proposed, not law. Insurance is a high-risk category in the Claude directory (human-in-the-loop, direct disclosure to consumers), so the wording needs a reviewed home.

## What Changes

- Add skill `health-cover-comparison` in the internal plugin (`plugin-internal/`), written for any host: intake (state, household type, who is covered and their age bands, hospital, extras or both, clinical categories wanted by name, excess limit, income tier only when the person raises the rebate or the surcharge), tool order (search, get, compare, then calculate), reading a clinical category matrix, quoting figures with file date and calculated labels, and what to say when a tool returns `NotEstimated`, `data_unavailable` or `not_in_dataset`.
- Hard guardrails in the skill and in the shared rules text: no recommendation or ranking language, no medical advice or judging what cover a condition needs, no help to cancel, switch or buy, no commission or referral, no general insurance, overseas student and visitor cover out of scope with a pointer to the official source, and a direct disclosure that Ask Righto is a free information tool and not an insurer, broker or adviser.
- Add activation prompts and negative prompts to `docs/skills/activation-prompts.md`.
- Keep the skill unlisted in the public marketplace entry until the vertical passes the promotion gates.

Hosts affected: Claude and ChatGPT (skill conversion), Gemini via server instructions only. Data and licence: none new; the skill text states the sources it relies on by name.

Out of scope: new tools, a course-style page-reader agent, extras limit modelling, a switching or provider-contact helper.

## Capabilities

### New Capabilities
- `health-cover-skills`: workflow and guardrails for health cover conversations.

### Modified Capabilities
None.

## Impact

- New `plugin-internal/skills/health-cover-comparison/`; additions to `src/health/instructions.ts` and `docs/skills/activation-prompts.md`; the shared rules generator is unchanged.
- Depends on `add-health-cover-tools` and on `add-host-guidance` already in place.
