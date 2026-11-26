# Proposal

## Why

`add-plugin-packaging` builds plugin packages, but they would be refused by the directories: no icon, licence, privacy policy, terms, support link or listing metadata, no OpenAI `interface` block or review test cases, and the config still names `askrighto.com.au`. Iven (26 Nov 2026) also wants users to install by uploading a zip in ChatGPT and Claude, and a researched answer for Gemini. `claude plugin validate --profile directory` and OpenAI's submission checks (read 26 Nov 2026) are the bar. `feimacode/open-design-agent-kit` already ships both official and manual routes and is the reference.

Hosts affected: Claude, ChatGPT, Gemini.

## What Changes

- Config gains author, licence, links (privacy, terms, support, docs), icon, OpenAI `interface` text, review test cases and release notes. Public domain switches to `askrighto.feimacode.com` everywhere (the switch to `.com.au` stays a config edit).
- Add the icon (`plugin/assets/icon.png`, a placeholder for Iven to replace), `LICENSE`, public `docs/legal/privacy.md` and `terms.md`, and a plugin `README.md` the Claude directory shows.
- `npm run plugin:build` writes ready-to-upload zips: `askrighto-claude-plugin.zip` (Claude upload and directory), `askrighto-chatgpt-plugin.zip` (ChatGPT portal and manual add) and `askrighto-gemini-extension.zip` (Gemini CLI extension), plus a Gemini Connected Apps sheet. A check script unzips each and verifies layout, limits and no internal route or skill.
- A release workflow builds the zips on `v*` tags and attaches them to the GitHub release.
- Docs: end-user install guide, a listing kit (reviewer guide, test cases, form answers), Gemini findings, and a list of steps only Iven can do.
- Optional route `/.well-known/google-connected-apps` for the Gemini Connected Apps preview (404 unless set).

Out of scope: the submissions themselves, screenshots and demo video, legal views (home loans), the `.com.au` domain, courses (internal only, never packaged).

## Capabilities

### New Capabilities
- `plugin-listing`: listing metadata and manual-install packages.

### Modified Capabilities
- `plugin-packaging`, `domain-verification` (from `add-plugin-packaging`): extended, not replaced.

## Impact

`plugin/askrighto.config.json`, `scripts/plugin.mjs`, new `scripts/check-plugin-zips.mjs`, `src/server/challenge.ts`, `src/config.ts`, `.github/workflows`, docs.
