# Proposal

## Why

Skills and the MCP server are built, but users must install them separately. Iven's channel order (24 Nov 2026) is: the Claude, ChatGPT and Gemini plugin directories first, and marketplace metadata in this GitHub repo second. Each directory wants a different package shape, and the public domain will change from `askrighto.feimacode.com` (test, now) to `askrighto.com.au` later. One source for plugin metadata, with one place for the server URL, keeps the channels in step and makes the domain switch a one-line change.

## What Changes

- Add one source file, `plugin/askrighto.config.json`, holding the name, description, version, public server URL (`https://askrighto.feimacode.com/mcp` for now), links (homepage, privacy, terms) and the list of public skills.
- Add `npm run plugin:build`, which writes from that source, into `dist/plugins/`:
  - **Claude:** the plugin folder with `.claude-plugin/plugin.json`, `.mcp.json` (remote HTTP server at the configured URL) and `skills/`, for the Claude directory submission.
  - **ChatGPT:** a portable plugin with root `plugin.json`, `mcp.json` (`streamable-http`, auth `none`) and `skills/`, zipped for the OpenAI portal. No hooks, `userConfig` or Claude-only fields.
  - **Gemini:** a short registration sheet (server URL, tool list, annotations check). Gemini Connected Apps register the server, not a skills package, so no skills are shipped there. Wording to be confirmed when the preview admits us.
- Make the committed `.claude-plugin/marketplace.json` and `plugin/` files (the secondary, GitHub channel) generated from the same source, with `plugin:check` in CI so they cannot drift.
- Add `GET /.well-known/openai-apps-challenge`, returning the token set in `ASKRIGHTO_OPENAI_CHALLENGE` (404 when unset), needed for the ChatGPT submission.
- Public package contains energy skills only. The internal course skills are never bundled with the server URL, because the internal route's URL holds a secret token.

Out of scope: the directory submissions themselves (`add-claude-listing`, `add-chatgpt-listing`, `add-gemini-listing`), screenshots, video, policy attestations, and the move to `askrighto.com.au`.

## Capabilities

### New Capabilities

- `plugin-packaging`: the single source and the per-channel builds.
- `domain-verification`: the ChatGPT challenge route.

### Modified Capabilities

None.

## Impact

- New: `plugin/askrighto.config.json`, `scripts/plugin.mjs`, one route in `src/main.ts`, tests, CI step.
- Changes the committed marketplace and plugin manifests from hand-written to generated.
