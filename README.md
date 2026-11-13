# Ask Righto

Everyday Aussie decisions, backed by public data. askrighto.com.au

One hosted MCP server for the Claude directory, ChatGPT and Gemini. Starts with comparing
electricity and gas plans; uni course choice comes next.

- Plan: [ROADMAP.md](ROADMAP.md)
- Working rules for people and agents: [AGENTS.md](AGENTS.md)
- Feature specs: [openspec/](openspec/) (managed with [OpenSpec](https://github.com/Fission-AI/OpenSpec))

Status: pilot, pre-alpha. The server core runs; energy plan tools are in progress.

## Run it

```sh
npm install
npm run build          # bundles dist/askrighto.js
npm run start:stdio    # developer-only: MCP over stdio, see below
npm start              # MCP over Streamable HTTP at http://127.0.0.1:3001/mcp (/healthz, /readyz)
npm test               # build, then unit and end-to-end tests
```

**stdio is for development only** (MCP Inspector, local debugging, the end-to-end test). It is not a way
to use the product: the tools read plans from PostgreSQL, so stdio needs `DATABASE_URL` and a loaded
database, and end users never run the server themselves. Claude, ChatGPT and Gemini use the hosted
HTTP endpoint (`/mcp`).

Settings (all optional): `PORT`, `HOST`, `ASKRIGHTO_PUBLIC_URL`, `ASKRIGHTO_BODY_LIMIT` (default 256kb),
`ASKRIGHTO_RATE_LIMIT` (requests per window per client, default 120), `ASKRIGHTO_RATE_WINDOW_MS` (default 60000),
`ASKRIGHTO_ALLOWED_HOSTS` (comma-separated host names, e.g. `askrighto.com.au`), `ASKRIGHTO_TRUST_PROXY`,
`ASKRIGHTO_CLIENT_IP_HEADER` (e.g. `cf-connecting-ip`), `ASKRIGHTO_LOG=off`. The access log never records tool arguments.

Try asking (see [docs/energy-estimates.md](docs/energy-estimates.md)): "What energy plans are available at 3000?",
"Compare electricity plans at 3000 on CitiPower, I used 1,000 kWh over 90 days."

Adding a tool: [docs/adding-a-tool.md](docs/adding-a-tool.md).
