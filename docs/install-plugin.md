# Install Ask Righto by hand

Until Ask Righto is in a directory, you can add it yourself. The server is public, needs no account and runs on our side: `https://askrighto.feimacode.com/mcp`.

Three ready-made packages are attached to every [GitHub release](https://github.com/feimacode/askrighto/releases) (with the version in the name), or come from `npm run plugin:build`: `askrighto-claude-plugin.zip`, `askrighto-chatgpt-plugin.zip` and `askrighto-gemini-extension.zip`. Each holds the same six energy skills; only the manifest differs. Check a download against `SHA256SUMS`.

## Claude (claude.ai, desktop, Cowork)

**Upload the zip.** Customize > Plugins > Add > Upload plugin, then choose `askrighto-claude-plugin.zip`. Anthropic does not review uploaded plugins. The plugin brings the server with it (see its Connectors tab) and its skills.

**Or add the GitHub marketplace.** Customize > Plugins > Add > Add marketplace, enter `feimacode/askrighto`, then install **askrighto**. In Claude Code:

```
/plugin marketplace add feimacode/askrighto
/plugin install askrighto@askrighto
```

(The marketplace also lists `askrighto-internal`, which is for testers; ignore it.)

**Or only the server.** Settings > Connectors > Add custom connector, URL above, no sign-in. You get the tools without the skills.

## ChatGPT

**Server only (works today).** In ChatGPT, open Plugins, choose the plus button, **Add custom MCP server**, give it a name, enter the URL above under Connection > public endpoint, set authentication to none, accept the warning and choose **Create as a plugin**. Type `@` in the prompt box to use it. On some plans you first need developer mode (Settings > Apps > Advanced). Source: developers.openai.com/plugins/deploy/connect-chatgpt, read 26 Nov 2026.

**With skills: the zip.** `askrighto-chatgpt-plugin.zip` is the package the OpenAI submission portal takes: Platform dashboard > Plugins > **Upload new or existing plugin** > pick a verified developer identity > **Upload plugin** > choose the zip. It stays a private draft until you submit it, so it also works as a test install. We found no page describing an in-ChatGPT button that takes a zip from an ordinary user; if your ChatGPT shows one under Plugins, the same zip is what it wants.

## Gemini

- **Gemini app:** Settings > **Connected Apps** > **Add a custom app**, paste the URL, no credentials. Needs a personal Google account, age 18 or over, in the US, English only, with Gemini Apps activity on (Google help, read 26 Nov 2026). The app has no skills or zip route. Use `@Ask Righto` in a prompt.
- **Gemini CLI:** unzip `askrighto-gemini-extension.zip` into a folder and run `gemini extensions install <that folder>` (or `gemini extensions link <folder>`). It adds the server (`httpUrl`), the skills and a short `GEMINI.md`. Google's docs say Gemini CLI was replaced by Antigravity CLI on 18 June 2026 for free-tier and Google One users, so this route is best effort; see [Gemini findings](listing/gemini.md).

## Check it works

Ask: "Which electricity plans are available for a home in postcode 3000?" The assistant should ask whether it is a home or a business, then list plans with a source link and an as-of date and no "best plan".

## Rebuild or change the packages

Edit `plugin/askrighto.config.json` (one source for the name, URL, links and listing text), then `npm run plugin:sync` (committed files) and `npm run plugin:build` (zips in `dist/plugins/`). CI runs `plugin:check` and the zip checker. Locally you can also run `claude plugin validate --strict --profile directory ./plugin`.
