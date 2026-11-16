# Tasks

## 1. Shared rules

- [x] 1.1 Extract the base grounding rules into `src/guidance/shared.ts` and use them in the server instructions (vertical texts are unchanged, so their wording stays as tested); verify the instruction tests still pass
- [x] 1.2 Add the generate step (`npm run guidance:generate`, `guidance:check` in CI) and the staleness test; verify editing the source without regenerating fails the test

## 2. Bundle

- [x] 2.1 Add `plugin/.claude-plugin/plugin.json`, root `.claude-plugin/marketplace.json` and `plugin/skills/ask-righto-grounding/`; verify the manifest validates with the current Claude plugin validator
- [x] 2.2 Add the wording test (no host product names, user-first line present); verify it passes
- [ ] 2.3 Activation prompts are written in `docs/skills/activation-prompts.md`; still to do: run them in Claude and ChatGPT developer mode and record results

## Workflow follow-up

- Archive after review so `skill-bundle` becomes a main spec.
