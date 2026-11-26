# Design

## Decisions

- **One config, many manifests.** Everything listing-related lives in `plugin/askrighto.config.json`. The generator renders the Claude manifest (`privacyPolicyUrl`, `supportUrl`, `termsOfServiceUrl`, `documentationUrl`, `icon`, `license`, `author`), the OpenAI manifest (`extensions["com.openai"].interface`, plus `review` and `publication` for the portal) and the Gemini manifest.
- **Reference:** open-design-agent-kit puts OpenAI review test cases and release notes inside `plugin.json` under `extensions["com.openai"]`. We follow that, since the portal reads them from the zip. Reviewer credentials stay out (the portal rejects them); we need none, the server is public and read-only.
- **Claude zip = the plugin folder contents** (`.claude-plugin/plugin.json` at the root of the zip plus `.mcp.json`, `skills/`, `README.md`, icon). Same zip serves the manual upload (Customize > Plugins > Add > Upload plugin) and the directory form (which takes a repo; the zip is for manual use).
- **ChatGPT zip is the remote-MCP listing variant** (`plugin.json`, `mcp.json`, `skills/`, `assets/`). No `.app.json`, no hooks (the portal cannot take them).
- **Gemini:** Gemini CLI extension zip (`gemini-extension.json`, `GEMINI.md`, `skills/`, `mcpServers.askrighto.httpUrl`). The Gemini app has no skills or zip route; it takes an MCP URL under Settings > Connected Apps > Add a custom app (US, English, 18+ only), and developers apply to the Connected Apps preview. Gemini CLI docs carry a notice that it was replaced by Antigravity CLI on 18 Jun 2026, so the extension is best effort.
- **Validation in CI** uses our own zip checker (no Claude CLI in CI). Locally, `claude plugin validate --profile directory` is part of the documented check.
- **Icon:** generated placeholder PNG (512 px) committed; the Claude portal keeps the first icon it sees, so Iven should replace it before the first submission.
- **Licence:** MIT proposed to match the reference repo; Iven to confirm. Data licences differ and are recorded in `docs/data-rights.md`.
- **Support contact:** GitHub issues until Iven gives an email.

## Risks

- OpenAI field names come from docs summaries read on 26 Nov 2026 and are unverified against the portal; the portal's "Copy issues" report is the real test.
- The privacy policy states facts from `docs/architecture.md` section 5.8; Iven must check it before submission.
