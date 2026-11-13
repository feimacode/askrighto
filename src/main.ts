#!/usr/bin/env node
/**
 * Ask Righto entry point.
 *   askrighto          stdio (default). DEVELOPMENT ONLY: for the MCP Inspector, local debugging and
 *                      tests. The product is the hosted HTTP endpoint; stdio would need database credentials.
 *   askrighto --http   streamable HTTP on PORT (default 3001), path /mcp
 */
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { httpConfig } from "./config.js";
import { startEnergy } from "./energy/index.js";
import { runReadiness } from "./core/readiness.js";
import { createServer } from "./server/create-server.js";
import { clientKey, describeRpc, logLine, RateLimiter } from "./server/limits.js";
import { VERSION } from "./version.js";

async function startHttp(): Promise<void> {
  // Loaded lazily so stdio start-up never parses the HTTP stack.
  const { createMcpExpressApp, hostHeaderValidation } = await import("@modelcontextprotocol/express");
  const { NodeStreamableHTTPServerTransport } = await import("@modelcontextprotocol/node");
  type Request = import("express").Request;
  type Response = import("express").Response;
  type NextFunction = import("express").NextFunction;
  const cfg = httpConfig();
  const energy = await startEnergy();
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST ?? "127.0.0.1";
  const app = createMcpExpressApp({ host: "0.0.0.0", jsonLimit: cfg.bodyLimit });
  if (cfg.trustProxy) app.set("trust proxy", true);

  // Metadata-only access log: method, path, status, timing, JSON-RPC method and
  // tool name. Never arguments, results, headers or query strings.
  if (cfg.log) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      if (req.path === "/healthz" || req.path === "/readyz") return next();
      res.on("finish", () => {
        const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
        console.error(logLine({ method: req.method, path: req.path, status: res.statusCode, ms, ...describeRpc(req.body) }));
      });
      next();
    });
  }

  // Host allow-list (DNS rebinding protection) on the MCP endpoint only, so
  // health checks from the container platform keep working.
  if (cfg.allowedHosts?.length) app.use("/mcp", hostHeaderValidation(cfg.allowedHosts));

  const limiter = new RateLimiter(cfg.rateLimit, cfg.rateWindowMs);
  app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
    const retry = limiter.take(clientKey(req.headers, req.ip, cfg.clientIpHeader));
    if (!retry) return next();
    res.set("Retry-After", String(retry));
    res.status(429).json({ jsonrpc: "2.0", error: { code: -32000, message: "Too many requests, try again shortly" }, id: null });
  });

  app.get("/", (_req: Request, res: Response) => {
    res.type("text/plain").send(`Ask Righto ${VERSION} MCP server. Endpoint: /mcp\n`);
  });
  // Liveness: never touches a database or any other dependency.
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true, version: VERSION });
  });
  // Readiness: 200 only when every registered check passes.
  app.get("/readyz", async (_req: Request, res: Response) => {
    const r = await runReadiness();
    res.status(r.ok ? 200 : 503).json({ ok: r.ok, version: VERSION, checks: r.checks });
  });

  // Stateless: a fresh server and transport per request, no sessions.
  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      // Log the error only, never the request body (it can hold personal data).
      console.error("MCP error:", error instanceof Error ? error.message : error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  // Body parser errors (oversized or malformed JSON): answer without echoing or logging the body.
  app.use((err: { status?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.status === 413 ? 413 : err.status === 400 ? 400 : 500;
    const message = status === 413 ? `Request body over ${cfg.bodyLimit}` : status === 400 ? "Invalid JSON" : "Internal server error";
    res.status(status).json({ jsonrpc: "2.0", error: { code: status === 500 ? -32603 : -32700, message }, id: null });
  });

  const httpServer = app.listen(port, host, () => {
    console.log(`Ask Righto ${VERSION} listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}/mcp`);
  });
  const shutdown = () => httpServer.close(() => void (energy?.stop() ?? Promise.resolve()).finally(() => process.exit(0)));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
  } else if (args.includes("--help") || args.includes("-h")) {
    console.log(`Ask Righto ${VERSION}: everyday Aussie decisions, backed by public data.

Usage:
  askrighto            run over stdio (development only: Inspector, debugging, tests)
  askrighto --http     run over streamable HTTP on PORT (default 3001), path /mcp
  askrighto migrate    apply database migrations (needs DATABASE_URL)
  askrighto sync-energy [--record DIR] [--retailer SLUG]
                       load or refresh energy plans; --record saves raw API responses as fixtures`);
  } else if (args[0] === "migrate") {
    await (await import("./energy/cli.js")).cliMigrate();
  } else if (args[0] === "sync-energy") {
    await (await import("./energy/cli.js")).cliSyncEnergy(args.slice(1));
  } else if (args.includes("--http")) {
    await startHttp();
  } else {
    // stdout carries the protocol, so nothing else may print to it.
    await startEnergy();
    await createServer().connect(new StdioServerTransport());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
