# Tasks

## 1. Shared rules

- [ ] 1.1 Extract the grounding rules into `src/guidance/shared.md` and import them from the energy and course instructions; verify existing instruction tests still pass
- [ ] 1.2 Add the generate step and the staleness test; verify editing the source without regenerating fails the test

## 2. Bundle

- [ ] 2.1 Add `plugin/.claude-plugin/plugin.json`, root `.claude-plugin/marketplace.json` and `plugin/skills/ask-righto-grounding/`; verify the manifest validates with the current Claude plugin validator
- [ ] 2.2 Add the wording test (no host product names, user-first line present); verify it passes
- [ ] 2.3 Write activation prompts (direct, indirect, incomplete, non-matching) in `docs/skills/`; verify them in Claude and ChatGPT developer mode and record results

## Workflow follow-up

- Archive after review so `skill-bundle` becomes a main spec.
