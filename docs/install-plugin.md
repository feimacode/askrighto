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

| Route | Skills | Where it works |
| --- | --- | --- |
| Directory listing (once approved) | Yes | Every surface the public directory reaches |
| Custom MCP server | No (the server's own instructions and `get_energy_guide` carry the rules) | ChatGPT on the web; mobile not confirmed |
| Uploaded zip | Yes, and the server comes with it | ChatGPT desktop app only ("Open in desktop app") |

**Web (and probably mobile): the custom MCP server.** In ChatGPT on the web, open Plugins, choose the plus button, **Add custom MCP server**, give it a name, enter the URL above under Connection > public endpoint, set authentication to none, accept the warning and choose **Create as a plugin**. Type `@` in the prompt box to use it. On some plans you first need developer mode (Settings > Apps > Advanced). Source: developers.openai.com/plugins/deploy/connect-chatgpt, read 26 Nov 2026. A server added on the web should follow the account to the mobile app; not yet checked.

**Desktop, with skills: the zip.** Upload `askrighto-chatgpt-plugin.zip` under Plugins. The plugin brings the skills and adds the server; its settings show both. ChatGPT treats an uploaded plugin as a local one, and OpenAI's docs say to "use the ChatGPT desktop app to install and test a local plugin", so it shows "Open in desktop app" and runs only in the desktop app (seen 26 Nov 2026; open-design-agent-kit's zip behaves the same). Nothing in the zip makes it desktop-only in OpenAI's sense (no local server, hooks or `requires_local_executor`), so the same zip should reach web and mobile once it is approved in the directory.

Zips before 0.1.1 put `extensions.com.openai.auth` on the server in `mcp.json`; with it, ChatGPT installed the skills but not the server. Use 0.1.1 or later.

**Directory submission.** The same zip is what the OpenAI portal takes: Platform dashboard > Plugins > **Upload new or existing plugin** > pick a verified developer identity > **Upload plugin**. See [listing/directory-listings.md](listing/directory-listings.md). A Business or Enterprise admin can also publish a plugin to their own workspace; only that workspace's members see it.

## Gemini

- **Gemini app:** Settings > **Connected Apps** > **Add a custom app**, paste the URL, no credentials. Needs a personal Google account, age 18 or over, in the US, English only, with Gemini Apps activity on (Google help, read 26 Nov 2026). The app has no skills or zip route. Use `@Ask Righto` in a prompt.
- **Gemini CLI:** unzip `askrighto-gemini-extension.zip` into a folder and run `gemini extensions install <that folder>` (or `gemini extensions link <folder>`). It adds the server (`httpUrl`), the skills and a short `GEMINI.md`. Google's docs say Gemini CLI was replaced by Antigravity CLI on 18 June 2026 for free-tier and Google One users, so this route is best effort; see [Gemini findings](listing/gemini.md).

## Check it works

Ask: "Which electricity plans are available for a home in postcode 3000?" The assistant should ask whether it is a home or a business, then list plans with a source link and an as-of date and no "best plan".

## Rebuild or change the packages

Edit `plugin/askrighto.config.json` (one source for the name, URL, links and listing text), then `npm run plugin:sync` (committed files) and `npm run plugin:build` (zips in `dist/plugins/`). CI runs `plugin:check` and the zip checker. Locally you can also run `claude plugin validate --strict --profile directory ./plugin`.
