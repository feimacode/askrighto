## Context

Existing skills (`ask-righto-grounding`, `energy-bill-comparison`, and the unlisted course skills) show the form: short, host-neutral, no provider names, no agents or hooks, base rules generated from `src/guidance/shared.ts`. Health cover adds three risks the others do not carry: health information, tax-flavoured calculations, and a high-risk directory category.

## Decisions

1. **One skill.** `health-cover-comparison` covers search, compare and the three calculations. Splitting a tax skill off adds a trigger problem (the person asks one question and needs both).
2. **Intake order.** State; who is covered (single, couple, family, single parent) and age bands; hospital, extras or both; clinical categories wanted by their published names; maximum excess. Ask income only when the person asks about the rebate or surcharge, accept a tier or a figure for this call, and say it is not stored. Do not ask for conditions, treatments, medications, member numbers or insurer account details; if a person volunteers them, do not repeat them into tool calls and say so.
3. **Categories by name.** The skill tells the host to turn a person's need ("I'm planning a baby") into the category names the tools list ("Pregnancy and birth") only when the person has said that is the cover they want, and not to judge what they need. It also states the waiting period facts as the tools return them.
4. **Calculation framing.** Surcharge test shown as two figures and a difference, with "the ATO calculator and your insurer decide". Rebate shown as "calculated using ATO rates effective <date>". Proposed rebate change for people 65 and over described only as proposed and not law, with the Department of Health link.
5. **Forbidden wording** mirrored from the tools: best, right for you, should, recommend, worth it, "you'll save". The skill gives allowed replacements ("the lowest premium among these filters is...").
6. **Disclosure line.** First reply in a health cover conversation says Ask Righto gives factual comparisons from public data, is free, takes no commissions and is not an insurer, broker or adviser, and tells the person to confirm with the insurer. This answers the directory's disclosure requirement for high-risk categories.
7. **Not-found handling.** `data_unavailable`, `rules_out_of_range` and `rebate_basis_unclear` are relayed plainly with the official link (ATO or insurer). The host does not fill the gap from its own knowledge; if the person's own browsing assistant reads an insurer page, the AGENTS.md rule 1 labelling applies (quoted with link and time, labelled, never sent back to us).
8. **Out of scope redirects.** General insurance, overseas student or visitor cover, and "should I switch" get a short redirect to the official source (privatehealth.gov.au for the person's own research, the Ombudsman for complaints), without comparing.
9. **Unlisted until promotion.** The marketplace entry omits the skill; a test checks that.

## Risks / Trade-offs

- Hosts may add their own medical or financial commentary. The skill reduces it; the evaluation change measures it.
- Skills for the three hosts differ in how reliably they trigger. Activation prompts record real behaviour; none is assumed.
- Mentioning the privatehealth.gov.au site could be read as endorsing a scrape. The skill links to it as a person-facing resource only.

## Open Questions

- Should the skill ever suggest the person ask their own browsing assistant to read an insurer's page? Default yes for extras limits or product pages the file does not link, subject to rule 1.
