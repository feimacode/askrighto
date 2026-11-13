# Design

## Context

The repo holds only planning files. `feimacode/inkview` is the house pattern for a hosted MCP server: TypeScript, the official MCP SDK v2 packages, Express for HTTP, an esbuild single-file bundle, stateless, access log without arguments, and the `INKVIEW_*` limit settings. The previous pilot (`vce-subject-planner`) already returns `{ found: false }` from its lookups, which is the behaviour the envelope generalises. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- One process that serves `/mcp`, `/healthz` and stdio from a single bundled file.
- A tool author cannot return a fact without a source and date, and cannot register a tool the directories would reject.
- The same checks Inkview runs: smoke test over HTTP and stdio, and a log test with a sentinel.

**Non-Goals:**

- Deployment, image builds and listings.
- Sessions, resumability or server-initiated messages. Stateless request and response is enough for read-only lookups.
- A plugin system. Verticals are plain modules that call `registerTool`.

## Decisions

**1. Follow Inkview's stack and layout.** Node 20+, TypeScript ESM, `@modelcontextprotocol/server` with the Express adapter, `zod` for schemas, esbuild to `dist/askrighto.js`, `--http` flag for HTTP and stdio by default. Alternative: a web framework such as Hono or Fastify. Rejected: the deploy pattern, Dockerfile and ops settings are already proven on Express in Inkview, and Iven asked for the same pattern.

**2. Stateless Streamable HTTP.** A fresh server and transport per request with no session id, as Inkview's hosted build does. Alternative: sessions with in-memory state. Rejected: it breaks running several instances and adds stored state the directories ask about.

**3. `defineTool` wrapper instead of calling the SDK directly.** Verticals register tools through one helper that (a) validates name, annotations and schema flatness at startup, (b) forces the handler to return a `Grounded<T>` value, and (c) renders both structured content and text. Handlers return either `{ found: true, data, source, asOf, items?, warnings? }` or `{ found: false, reason, message }`; the type system has no third option. Alternative: a lint rule or review checklist. Rejected: the rule is the product's main promise, so it should fail the build, not a review.

**4. Envelope shape.**

```ts
type Source = { name: string; url: string; licence: string; attribution?: string };
type Grounded<T> =
  | { found: true; data: T; source: Source; asOf: string; warnings?: string[] }
  | { found: false; reason: NotFoundReason; message: string };
```

`asOf` is ISO 8601. Per-item `url` and `asOf` live inside `data` items where items have their own pages. The text form ends with a fixed footer: `Source: <name> (<url>), as of <date>. <attribution>`. The field names match what Inkview's provenance strip expects (`source.name`, `source.url`, `retrievedAt`), so results can be passed to Inkview components without mapping.

**5. Source registry.** A module-level registry where each data module registers `{ id, publisher, licence, url, coverage, refreshedAt(), maxAgeHours }`. `list_data_sources` reads it, and the wrapper uses `maxAgeHours` to add the staleness warning. Alternative: static documentation. Rejected: the refresh time has to be live.

**6. Operations settings copy Inkview's names with an `ASKRIGHTO_` prefix** (`ASKRIGHTO_RATE_LIMIT`, `ASKRIGHTO_BODY_LIMIT`, `ASKRIGHTO_ALLOWED_HOSTS`, `ASKRIGHTO_TRUST_PROXY`, `ASKRIGHTO_CLIENT_IP_HEADER`, `ASKRIGHTO_LOG`), so the Ansible role in `feima-infra` can be adapted with a rename.

**7. Tests with Vitest.** Unit tests for the wrapper and envelope, plus script-style smoke tests that start the built bundle and talk MCP over HTTP and stdio, as Inkview does.

## Risks / Trade-offs

- [The MCP SDK v2 packages change quickly] → Pin the versions Inkview pins and upgrade both repos together.
- [Flat-schema rule makes some inputs awkward, such as a usage profile] → Use separate scalar fields; this is Google's stated rule and the strictest of the three hosts.
- [Host models may still paraphrase figures] → Server instructions and the text footer repeat source and date; a host guidance skill follows in the listing phase.
- [Rate limiting by IP is weak behind host proxies, where many users share addresses] → Make the limit configurable and read the real client IP header behind Cloudflare, as Inkview does.

## Open Questions

- Whether Gemini needs any transport setting that differs from Claude and ChatGPT. It cannot be tested until preview access opens, and it does not change this design.
