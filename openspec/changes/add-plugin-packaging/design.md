# Design

## Channel order

Primary: the three directories (Claude, ChatGPT, Gemini). Secondary: marketplace metadata in this repo, which lets testers and early users install straight from GitHub. The generator treats the repo files as one more output, not the source.

## One URL

`serverUrl` lives once in `plugin/askrighto.config.json`. Switching to `askrighto.com.au` is one edit plus a rebuild. A test fails if any generated file contains a different host than the config.

## Claude `.mcp.json` shape

Plugin docs show `mcpServers` with a name per server. The remote HTTP shape (`type: http`, `url`) is taken from the general MCP page, not from a plugin example, so the first task is a real install test in Claude. Plugin servers start when the plugin is enabled.

## ChatGPT shape

Portable layout from OpenAI's plugin docs: root `plugin.json`, `mcp.json` with `type: streamable-http`, `skills/`. Auth `none` for public data. The portal also needs the endpoint entered directly and the challenge token served at `/.well-known/openai-apps-challenge`. Skills go in the same draft. Hooks and `userConfig` are rejected, and the build fails if they appear.

## Gemini

Connected Apps register the MCP server (annotations matter: a missing annotation is treated as destructive). Unknown whether Gemini loads skills; the build only emits a registration sheet until the preview shows otherwise.

## Challenge route

The token is an environment secret (`ASKRIGHTO_OPENAI_CHALLENGE`), set through feima-infra, not committed. The route sits outside the Host and rate guards used for tools only if the existing guards allow it, else the route is exempted like `/healthz`.

## Open questions

- How a Claude directory listing pairs the connector with the plugin (not found in the docs read).
- Whether the same plugin can carry both the connector and skills in the Claude directory, or the two are submitted separately.
- Whether `.well-known` must be on the final domain (assumed yes; re-verify after the domain change).
