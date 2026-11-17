## 1. Write the skill

- [x] 1.1 Write `plugin-internal/skills/health-cover-comparison/SKILL.md` with intake order, tool order, calculation framing, disclosure line, allowed and forbidden wording and not-found handling, using no provider names and no agents or hooks
- [x] 1.2 Add the health cover section to `src/health/instructions.ts` (the shorter server-side version for hosts without skills) and regenerate `rules.md` if the shared rules change
- [x] 1.3 Add the health redirects (general insurance, overseas cover, "should I switch") to the skill

## 2. Activation and negative prompts

- [x] 2.1 Add at least five positive and three negative prompts to `docs/skills/activation-prompts.md` (negatives: "which is the best fund", "should I cancel my cover", "my doctor says I need surgery, what cover covers it")
- [ ] 2.2 Run the prompts in Claude (and ChatGPT when its conversion exists) on the internal route and record what happened; mark untested hosts as untested

## 3. Checks

- [x] 3.1 Test that the skill is absent from the public marketplace entry and that CI fails if it is listed before promotion
- [x] 3.2 Test that the skill and instructions contain no banned phrase except in the list of forbidden words
- [ ] 3.3 Re-read the Claude directory policy on insurance and health topics and record the requirements the skill meets (direct disclosure, human in the loop, no health data on submission)
