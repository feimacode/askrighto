## 1. Rules source

- [x] 1.1 Write `src/homeloans/guidance.ts` (wording rules, refusals, privacy and minors rules, calculator rules) and a generator that writes `plugin-internal/skills/home-loan-comparison/references/rules.md`; verify a CI check fails when the written copy is stale *(Note: the generator writes `plugin-internal/skills/home-loan-comparison/references/rules.md`)*

## 2. The skill

- [x] 2.1 Write `home-loan-comparison/SKILL.md` with name, a description that triggers on home loan rate, repayment and comparison questions, the intake and tool steps, and "Never" list; verify the file loads and passes the plugin manifest check
- [x] 2.2 Write `references/read-published-rates.md` and `references/worked-example.md` (one search, one comparison, one calculation, one refusal); verify every figure in the example comes from a fixture
- [x] 2.3 Keep the skill out of the public marketplace entry; verify a test that the public `plugin/` has no home loan skill

## 3. Activation and review

- [x] 3.1 Add activation prompts (positive: rate comparison, repayment question, offset question; negative: "which loan should I take", personal loan rates, savings accounts, "can I afford") to `docs/skills/activation-prompts.md`; verify each has an expected outcome
- [ ] 3.2 Add credit terms to the answer-review skill's banned wording and to `scripts/trace-numbers.mjs` so figures in a home loan answer are traced to tool results; verify a planted untraced rate is caught
- [ ] 3.3 Run the activation prompts in Claude and ChatGPT (and note Gemini's server-instructions-only behaviour); record results, and mark any not run as untested

## 4. Check before shipping

- [ ] 4.1 Confirm the refusal and disclosure wording against the legal view when it exists; until then mark every text draft and list the open questions in the pull request
