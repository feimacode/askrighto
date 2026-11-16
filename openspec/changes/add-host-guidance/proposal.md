# Proposal

## Why

The server already sends per-vertical host guidance (`ENERGY_INSTRUCTIONS`, `COURSE_INSTRUCTIONS`), but only through the MCP `instructions` field. Not every host reads that field, ChatGPT needs at least one valid skill to accept a plugin upload, and the roadmap plans a Claude plugin bundle and a ChatGPT plugin. Skills are the one format both hosts load, so the grounding rules need to ship as a skill too.

## What Changes

- Add a plugin folder in the repo with `.claude-plugin/plugin.json`, a `.claude-plugin/marketplace.json` at the repo root, and a `skills/` directory. Skills only: no agents, no hooks, no `userConfig`, so the same `skills/` folder converts to the ChatGPT plugin without edits.
- Add the skill `ask-righto-grounding`: quote only tool results, always show the source link and as-of date, treat `found: false` as "not available" and never fill the gap from memory, never say "best" or "recommended", and quote facts read by the user's own browsing assistant only with page link and time read, labelled as read by the assistant (AGENTS.md rule 1).
- Add a check that keeps the skill and the server instructions from drifting: shared rules live in one source file that both the server instructions and the skill's reference file are generated from.
- Wording is provider-neutral (no "Claude" in skill text), and states that explicit user instructions outrank the skill.

Hosts affected: Claude and ChatGPT (skill text), all three hosts via server instructions (unchanged behaviour).

Out of scope: vertical skills (see `add-energy-bill-skill`, `add-course-skills`), any listing or submission (`add-claude-listing`, `add-chatgpt-listing`), custom agents (OpenAI does not carry them over; Claude-only agents are deferred until guided browsing is tested).

## Capabilities

### New Capabilities

- `skill-bundle`: the plugin layout, the grounding skill, provider-neutral wording and the drift check.

### Modified Capabilities

None.

## Impact

- New files: `.claude-plugin/marketplace.json`, `plugin/.claude-plugin/plugin.json`, `plugin/skills/ask-righto-grounding/SKILL.md` and `references/`.
- A small build step and test under `test/` for the shared-rules source.
- No dataset, so no licence to state.
