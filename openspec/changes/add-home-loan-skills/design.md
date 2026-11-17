## Context

Skills here are `SKILL.md` files loaded by Claude and ChatGPT; Gemini uses server instructions only. Server-side notices (see `add-home-loan-tools`) are the hard guard because the server attaches them; the skill is the second layer and also sets the conversation shape. Neither can force a host's wording, which is why `add-home-loan-evaluation` tests real answers.

## Decisions

1. **One skill, not two.** Search, compare and calculate share one intake. A separate "mortgage calculator" skill would invite the calculator to be used as a decision aid on its own.
2. **Intake is about the product, not the person.** Questions: owner-occupier or investor; principal-and-interest or interest-only; variable or fixed (and the term); the user's approximate LVR as a figure they supply; features they want (offset, redraw, extra repayments). The skill tells the host to say that LVR is a figure the user works out or reads from their own documents, and never to estimate it from a property value or income.
3. **Shortlists, not recommendations.** The host may say "here are the lowest published owner-occupier variable rates for a 80 percent LVR, sorted as you asked". It must not choose one product. If asked "which one?", it answers that Ask Righto compares published figures and cannot say which suits them, and lists the differences that matter in the tool result.
4. **Refusal text is fixed.** Short, plain wording for the four refusals (suitability, approval, switching, application) in `references/`, so the review skill can match it.
5. **Comparison rate rule.** Quote it only as the tool returns it, with the caveat; never explain that a lower comparison rate means a cheaper loan.
6. **Shared source.** Credit rules live in `src/homeloans/guidance.ts`; a generator writes the skill's reference file and a test fails when stale, as `guidance:check` does for the shared rules.
7. **Unlisted until promotion.** The marketplace entry omits the skill; only a maintainer using the internal plugin loads it.

## Risks / Trade-offs

- Hosts may ignore skills. Mitigation: server notices and instructions; evaluation prompts include adversarial ones.
- Refusals can make the product feel useless. Mitigation: the skill still offers the factual comparison and the calculator, and the worked example shows a helpful answer that stays on the line.

## Open Questions

- Does the legal view want a mandatory disclosure sentence at the start of each answer, or only at the end? Draft both; pick after the view.
