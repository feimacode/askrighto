# Design

## Layout

Marketplace at the repo root points at `./plugin`; plugins are copied to a cache, so the plugin folder must not reference paths outside itself. Keep skills under `plugin/skills/<name>/SKILL.md` with `name` and `description` frontmatter; detail goes in `references/`.

## One source for shared rules

Decision: shared rules (quote only results, source and date, no "best", rule 1 wording) live in `src/guidance/shared.md`. A build step writes them into `plugin/skills/ask-righto-grounding/references/rules.md`, and the server instructions import the same text. A test fails if the generated file is stale. Why: two hand-kept copies of the grounding rules would drift, and the rules are the product's trust promise.

## Descriptions decide triggering

The skill description names the conditions ("any Ask Righto tool result is about to be quoted or summarised"), not the contents. Tested with direct, indirect, incomplete and non-matching prompts.

## Not doing

No agents or hooks: OpenAI says commands and agents become skills and hooks must be removed. Revisit a Claude-only course-page-reader agent after guided browsing is tested in Claude in Chrome.

## Open questions

- Exact `SKILL.md` frontmatter keys beyond `name` and `description` that Claude honours; check against the current Claude plugin docs when implementing.
- OpenAI states no skill size limit; keep each skill short.
