# Tasks

## 1. Project scaffold

- [ ] 1.1 Add `package.json`, `tsconfig.json`, esbuild build script and Vitest config, pinned to the MCP SDK versions Inkview uses; verify `npm install` and `npm run build` produce `dist/askrighto.js`
- [ ] 1.2 Add lint and typecheck scripts and a CI workflow running typecheck, build and tests on Node 20 and 22; verify the workflow passes on the pull request

## 2. Grounded results

- [ ] 2.1 Implement the `Grounded<T>` types, the source registry and the text renderer with the source footer; verify unit tests cover found, not-found, per-item sources, attribution and the staleness warning
- [ ] 2.2 Implement `defineTool`, which validates name, annotations and flat schema at startup and renders structured and text content; verify unit tests show startup fails for a tool missing a hint, a nested schema and a non verb-first name
- [ ] 2.3 Implement `list_data_sources`; verify a unit test returns `no_data_loaded` when empty and one entry per registered source otherwise
- [ ] 2.4 Document the envelope and how to add a tool in `docs/adding-a-tool.md`; verify the example in the doc compiles in the typecheck

## 3. Server

- [ ] 3.1 Implement stdio and stateless Streamable HTTP transports at `/mcp` with server instructions; verify smoke tests list tools and call `list_data_sources` over both transports
- [ ] 3.2 Implement `/healthz`; verify a test gets HTTP 200 with `ok` and the package version
- [ ] 3.3 Implement the access log; verify a test calls a tool with a sentinel argument and finds the tool name but not the sentinel in the log
- [ ] 3.4 Implement body limit, rate limit with `Retry-After`, `Host` allow-list and client IP header settings; verify tests get 413, 429 and a rejected host
- [ ] 3.5 Document the settings and local run commands in `README.md`; verify the documented commands start the server

## 4. Integration check

- [ ] 4.1 Run the built server with the MCP Inspector and confirm every tool shows a title and all three hints; record the result in the pull request
- [ ] 4.2 Confirm no dataset is bundled by this change, so there is no data licence to re-check yet; note it in the pull request

## Workflow follow-up

- Archive the change after review so `mcp-server` and `grounded-results` become main specs.
