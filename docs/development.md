# Development guide

Moved from the root README so that page can speak to end users. Start with [AGENTS.md](../AGENTS.md) for the working rules.

- Plan: [ROADMAP.md](../ROADMAP.md)
- Feature specs: [openspec/](../openspec/) (managed with [OpenSpec](https://github.com/Fission-AI/OpenSpec))

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

Try asking (see [docs/energy-estimates.md](energy-estimates.md)): "What energy plans are available at 3000?",
"Compare electricity plans at 3000 on CitiPower, I used 1,000 kWh over 90 days."

Victorian uni course tools (internal route only for now, see [docs/course-tools.md](course-tools.md)): "Which engineering courses at RMIT are held, and what was last year's lowest selection rank?", "Compare these three nursing degrees", "I do English, Chemistry and Biology: which of these courses do my subjects rule out?", "When do VTAC preferences close?". Extra settings: `ASKRIGHTO_VERTICALS`, `ASKRIGHTO_PUBLIC_VERTICALS`, `ASKRIGHTO_INTERNAL_TOKEN`, `ASKRIGHTO_ENV`, `ASKRIGHTO_DATA_DIR` (see [docs/deploying.md](deploying.md)). Reuse rights for every dataset: [docs/data-rights.md](data-rights.md).

Adding a tool: [docs/adding-a-tool.md](adding-a-tool.md). How it fits together, with implementation detail per area (platform, energy, VIC courses, international courses, skills and plugins): [docs/architecture.md](architecture.md).
