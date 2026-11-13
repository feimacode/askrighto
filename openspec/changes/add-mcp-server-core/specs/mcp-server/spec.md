# Spec Delta

## Purpose

The hosted Ask Righto MCP server: how hosts connect to it, what it keeps and logs, and the rules every tool it exposes must meet so one server passes the Claude, ChatGPT and Gemini directory reviews.

## ADDED Requirements

### Requirement: Serve MCP over HTTP and stdio
The server SHALL accept MCP requests over Streamable HTTP at the path `/mcp` and over stdio, and SHALL expose the same tools on both.

#### Scenario: Host lists tools over HTTP
- **WHEN** a client sends `initialize` and then `tools/list` to `/mcp`
- **THEN** the server returns its name, version, instructions and the full tool list

#### Scenario: Local client lists tools over stdio
- **WHEN** the server is started without the HTTP flag and a client sends `tools/list` on stdin
- **THEN** the server returns the same tool list as over HTTP

### Requirement: Health check
The server SHALL answer `GET /healthz` with HTTP 200 and a JSON body containing `ok: true` and the server version, without requiring any header.

#### Scenario: Health probe
- **WHEN** a load balancer requests `/healthz`
- **THEN** the response is HTTP 200 with `{"ok": true, "version": "<version>"}`

### Requirement: Stateless operation
The server SHALL NOT require accounts or sign-in and SHALL NOT keep any user-supplied data after a request completes. Any instance SHALL be able to answer any request.

#### Scenario: Two requests reach different instances
- **WHEN** two tool calls from the same chat are answered by different server instances
- **THEN** both succeed with the same results as if one instance had answered both

#### Scenario: No credentials offered
- **WHEN** a client connects without any authorisation header
- **THEN** the server serves all tools

### Requirement: Access log without user content
The server SHALL log one line per HTTP request with time, HTTP method, path, status, duration, JSON-RPC method and, for tool calls, the tool name. It SHALL NOT log tool arguments, tool results, request headers or query strings.

#### Scenario: Tool call with a sentinel argument
- **WHEN** a tool is called with an argument containing a unique sentinel value
- **THEN** the log line names the tool and the sentinel value appears nowhere in the log output

### Requirement: Request limits
The server SHALL reject request bodies over a configured size with HTTP 413, SHALL reject requests over a configured per-client rate with HTTP 429 and a `Retry-After` header, and SHALL reject requests whose `Host` header is not on the allow-list when one is configured.

#### Scenario: Client exceeds the rate limit
- **WHEN** one client IP sends more requests in a window than the configured limit
- **THEN** further requests in that window receive HTTP 429 with `Retry-After`

#### Scenario: Oversized body
- **WHEN** a request body exceeds the configured limit
- **THEN** the response is HTTP 413

### Requirement: Tool annotations and naming
Every tool SHALL declare a `title`, `readOnlyHint`, `destructiveHint` and `openWorldHint`, SHALL have a verb-first snake_case name, and SHALL take a flat input schema with no nested objects. The server SHALL fail to start if a registered tool breaks any of these rules.

#### Scenario: Tool list is inspected by a directory reviewer
- **WHEN** a client calls `tools/list`
- **THEN** every tool has a title and all three hints set explicitly

#### Scenario: A tool is registered without annotations
- **WHEN** the server starts with a tool that omits `readOnlyHint`
- **THEN** startup fails with an error naming the tool

### Requirement: Read-only tools
Every tool SHALL be read-only: it SHALL NOT change any data on behalf of the user and SHALL declare `readOnlyHint: true` and `destructiveHint: false`.

#### Scenario: Reviewer checks side effects
- **WHEN** any tool is called
- **THEN** no user-visible state anywhere is changed and the tool's annotations say it is read-only

### Requirement: Host guidance in server instructions
The server SHALL return `instructions` on `initialize` that tell the host model to quote figures only from tool results, to show the source and as-of date with each figure, and to say when the server reported not-found.

#### Scenario: Host reads instructions
- **WHEN** a client sends `initialize`
- **THEN** the response `instructions` contain the quoting, source and not-found rules
