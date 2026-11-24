# Tasks

## 1. Source and builds

- [ ] 1.1 Add `plugin/askrighto.config.json` and `scripts/plugin.mjs`; verify `npm run plugin:build` writes the Claude and ChatGPT packages with the configured URL
- [ ] 1.2 Generate `.claude-plugin/marketplace.json` and `plugin/.claude-plugin/plugin.json` from the source and add `plugin:check` to CI; verify a hand edit fails the check
- [ ] 1.3 Add tests: one host everywhere, no internal route or course skill, no hooks or `userConfig` in the ChatGPT package; verify they pass
- [ ] 1.4 Emit the Gemini registration sheet (URL, tool names, annotation check); verify every tool has all three hints

## 2. Challenge route

- [ ] 2.1 Add `/.well-known/openai-apps-challenge`; verify tests for set, unset and the log
- [ ] 2.2 Document `ASKRIGHTO_OPENAI_CHALLENGE` in `docs/deploying.md`; infra sets it in feima-infra

## 3. Host checks

- [ ] 3.1 Install the Claude package from the GitHub marketplace against `askrighto.feimacode.com` and confirm tools and skills load together; record result
- [ ] 3.2 Upload the ChatGPT zip to the portal draft ("With MCP") and record what it accepts or rejects
- [ ] 3.3 Read the Claude directory submission docs and record how a connector and plugin are paired (updates `add-claude-listing`)

## Workflow follow-up

- Domain switch to `askrighto.com.au` is a config edit plus rebuild. Archive after review.
