# Tasks

## 1. Source and builds

- [x] 1.1 Add `plugin/askrighto.config.json` and `scripts/plugin.mjs`; verify `npm run plugin:build` writes the Claude and ChatGPT packages with the configured URL
- [x] 1.2 Generate `.claude-plugin/marketplace.json` and `plugin/.claude-plugin/plugin.json` from the source and add `plugin:check` to CI; verify a hand edit fails the check
- [x] 1.3 Add tests: one host everywhere, no internal route or course skill, no hooks or `userConfig` in the ChatGPT package; verify they pass
- [x] 1.4 Emit the Gemini registration sheet (URL, tool names, annotations read from the built server); it lists every tool with its three hints, a check that none is missing is still to add

## 2. Challenge route

- [x] 2.1 Add `/.well-known/openai-apps-challenge`; verify tests for set, unset and the log
- [x] 2.2 Document `ASKRIGHTO_OPENAI_CHALLENGE` in `docs/deploying.md`; still to do: infra sets it in feima-infra

## 3. Host checks

- [ ] 3.1 Install the Claude package from the GitHub marketplace against `askrighto.feimacode.com` and confirm tools and skills load together; record result
- [ ] 3.2 (also confirm where `auth: none` goes in `mcp.json`; the build puts it under `extensions["com.openai"]` per the docs, unverified) Upload the ChatGPT zip to the portal draft ("With MCP") and record what it accepts or rejects
- [ ] 3.3 Read the Claude directory submission docs and record how a connector and plugin are paired (updates `add-claude-listing`)

## Workflow follow-up

- Domain switch to `askrighto.com.au` is a config edit plus rebuild. Archive after review.
