# Proposal

## Why

Ask Righto has no code yet. Every vertical on the roadmap, starting with energy plans, needs the same base: one hosted MCP server that Claude, ChatGPT and Gemini can connect to, and one result shape that makes every fact carry its source and date. Building that base once, before the first vertical, keeps the "no free-generated facts" rule in the server instead of in each tool author's memory.

## What Changes

- Add a TypeScript MCP server that speaks Streamable HTTP at `/mcp` (for the three hosts) and stdio (for local testing), with a `/healthz` endpoint.
- Make the server stateless: no accounts, no sessions kept between requests, no stored conversation data.
- Add an access log that records method, path, status, duration and tool name, and never tool arguments or results.
- Add rate limiting, a request body limit and a `Host` allow-list, following the settings Inkview's hosted server uses.
- Add a tool registration helper that refuses a tool without `title`, `readOnlyHint`, `destructiveHint` and `openWorldHint`, a verb-first name and a flat input schema.
- Add the grounded result envelope: every tool result carries `source` (name, URL, licence), `asOf`, and either the data or an explicit `found: false` with a reason.
- Add one first tool, `list_data_sources`, which reports each dataset the server holds, its licence, its publisher and when it was last refreshed. It returns an empty list until the energy data change lands.
- Add project tooling: build to a single bundled file, unit tests, an MCP smoke test, lint, and a CI workflow.

Hosts affected: Claude, ChatGPT and Gemini all connect to this server. No listing or packaging work is in this change.

Data: this change adds no dataset. `list_data_sources` reads the registry that later changes fill, so there is no licence or refresh cadence to state yet.

Out of scope:

- Any energy, course or insurance tool (see `add-energy-plan-data`, `add-energy-plan-tools`).
- Inkview UI components (first used in `add-energy-plan-tools`).
- Docker image, hosting, domain and directory listings (roadmap Phase 2).
- OAuth or any sign-in. Public data needs none.

## Capabilities

### New Capabilities

- `mcp-server`: the hosted server itself: transports, health check, statelessness, logging, limits and the rules every registered tool must meet.
- `grounded-results`: the result envelope that ties each fact to a source and date, the explicit not-found, and the data source registry.

### Modified Capabilities

None.

## Impact

- New code: `src/server/` (transports, limits, logging), `src/core/` (tool registration, result envelope, source registry), `test/`.
- New dependencies: `@modelcontextprotocol/server`, `@modelcontextprotocol/express`, `express`, `zod`; dev: `typescript`, `esbuild`, `vitest`, `@modelcontextprotocol/client`.
- New files at the root: `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`.
- Node 20 or later, matching Inkview.
