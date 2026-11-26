# Gemini: manual install and listing findings

Read on 26 Nov 2026. Items marked "unverified" were not on a Google-owned page or were not tested in a live account.

## What exists

| Route | Who | Skills? | Directory? |
| --- | --- | --- | --- |
| Gemini app > Settings > Connected Apps > Add a custom app (paste an MCP URL) | Any user: personal Google account, 18+, US, English, Gemini Apps activity on | No (not documented) | No; every user adds it themselves |
| Connected Apps Platform (Connected Console) | Developers, preview, apply first | No | Google review, then rollout to the countries, languages and products you choose |
| Gemini CLI extension (`gemini-extension.json`) | Developers and power users | Yes (`skills/<name>/SKILL.md`) | Gallery at geminicli.com/extensions indexes public GitHub repos with the topic `gemini-cli-extension` |

Sources: support.google.com/gemini/answer/17209137; developers.google.com/connected-apps (overview, `/mcp`, `/mcp/dev-mode`, `/gpc/perform-the-steps`); geminicli.com/docs/extensions/reference, `/writing-extensions`, `/releasing`.

## Connected Apps developer path (the one to pursue)

1. Apply for the preview: connected.google.com/console/help/?apply (Iven).
2. In Connected Console create a Connected app of type MCP server. Values are in `dist/plugins/gemini/registration.md` (built by `npm run plugin:build`): name, description under 30 words, at least three capabilities, at least three example prompts (two or more start with `@Ask Righto`), 512x512 PNG icon under 1 MB, terms and policy URLs, MCP endpoint, authorization "No".
3. Prove the domain: download `google-connected-apps.json`, set its text as `ASKRIGHTO_GOOGLE_CONNECTED_APPS` in feima-infra. The server then serves it at `/.well-known/google-connected-apps` (200, no redirect). Choose **Verify domain**.
4. **Sync tools**, set availability (start with Australia if offered; the consumer help page says custom apps are US-only today, so check the console), add testers (`@gmail.com` only) and test with `@Ask Righto`; Developer Mode at gemini.google.com/devmode shows tool schemas and annotations.
5. **Send for review**, then **Publish**.

Tools must carry `readOnlyHint` and `destructiveHint` (Gemini reads both); every tool already sets all three hints, and `plugin:build` fails if one is missing.

## Gemini CLI extension (built, best effort)

`askrighto-gemini-extension.zip` holds `gemini-extension.json` (`mcpServers.askrighto.httpUrl`), `GEMINI.md` and the six skills. Install: unzip, then `gemini extensions install <folder>`. To appear in the gallery the extension needs `gemini-extension.json` at the root of a public repo (or release archive) and the topic `gemini-cli-extension`; our repo root is not an extension, so a gallery listing would need a small separate repo (decision for Iven). Every Gemini CLI page carries a notice that it was replaced by Antigravity CLI on 18 June 2026 for free-tier and Google One users; we did not read the Antigravity pages, so whether extensions carry over is unverified.

## Unverified or not found

- Plan tiers and regions for custom apps beyond "US, English, 18+".
- Transport detail (streamable HTTP vs SSE) for the consumer path; our server speaks streamable HTTP.
- How a skill reaches the Gemini app: nothing documented.
- A public directory for third-party Connected Apps: none documented.
