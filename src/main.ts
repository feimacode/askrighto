#!/usr/bin/env node
/**
 * Ask Righto entry point.
 *   askrighto          stdio (default). DEVELOPMENT ONLY: for the MCP Inspector, local debugging and
 *                      tests. The product is the hosted HTTP endpoint; stdio would need database credentials.
 *   askrighto --http   streamable HTTP on PORT (default 3001), path /mcp
 */
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { httpConfig } from "./config.js";
import {
  INTERNAL_PATH,
  maskInternalPath,
  tokenMatches,
} from "./server/internal.js";
import { startEnergy } from "./energy/index.js";
import { assertHomeLoanPublicGuard } from "./homeloans/guard.js";
import { runReadiness } from "./core/readiness.js";
import { metricsText } from "./core/metrics.js";
import { createServer } from "./server/create-server.js";
import { ALL_VERTICALS, setFor } from "./server/route.js";
import {
  failedVerticals,
  markVerticalFailed,
  parseVerticalFlags,
} from "./verticals.js";
import {
  clientKey,
  describeRpc,
  logLine,
  RateLimiter,
} from "./server/limits.js";
import { VERSION } from "./version.js";

/** Loads the verticals named in the flags. A failing public vertical stops start-up; an internal-only one is marked failed. */
async function startVerticals(env: NodeJS.ProcessEnv = process.env) {
  const flags = parseVerticalFlags(env);
  assertHomeLoanPublicGuard(flags.public, env);
  const stops: Array<() => Promise<void>> = [];
  for (const id of flags.loaded) {
    const v = ALL_VERTICALS.find((x) => x.id === id);
    if (!v)
      throw new Error(
        `Vertical "${id}" is named in ASKRIGHTO_VERTICALS but is not part of this build`,
      );
    try {
      const stop = await v.start(env);
      if (stop) stops.push(stop);
    } catch (e) {
      if (flags.public.includes(id)) throw e;
      markVerticalFailed(
        id,
        e instanceof Error ? e.message : "failed to start",
      );
      console.error(
        `vertical "${id}" failed to start and is unavailable on the internal route: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
  return {
    flags,
    stop: async () => void (await Promise.allSettled(stops.map((f) => f()))),
  };
}

async function startHttp(): Promise<void> {
  // Loaded lazily so stdio start-up never parses the HTTP stack.
  const { createMcpExpressApp, hostHeaderValidation } =
    await import("@modelcontextprotocol/express");
  const { NodeStreamableHTTPServerTransport } =
    await import("@modelcontextprotocol/node");
  type Request = import("express").Request;
  type Response = import("express").Response;
  type NextFunction = import("express").NextFunction;
  const cfg = httpConfig();
  const { flags, stop: stopVerticals } = await startVerticals();
  const publicSet = setFor(flags.public);
  const internalSet = setFor(flags.loaded);
  const internalToken =
    process.env.ASKRIGHTO_INTERNAL_TOKEN?.trim() || undefined;
  if (internalToken && internalToken.length < 43)
    throw new Error(
      "ASKRIGHTO_INTERNAL_TOKEN must be at least 32 random bytes, base64url (43 characters)",
    );
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST ?? "127.0.0.1";
  const app = createMcpExpressApp({
    host: "0.0.0.0",
    jsonLimit: cfg.bodyLimit,
  });
  if (cfg.trustProxy) app.set("trust proxy", true);

  // Metadata-only access log: method, path, status, timing, JSON-RPC method and
  // tool name. Never arguments, results, headers or query strings.
  if (cfg.log) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      if (req.path === "/healthz" || req.path === "/readyz") return next();
      res.on("finish", () => {
        const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
        console.error(
          logLine({
            method: req.method,
            path: maskInternalPath(req.path),
            status: res.statusCode,
            ms,
            ...describeRpc(req.body),
          }),
        );
      });
      next();
    });
  }

  // Host allow-list (DNS rebinding protection) on the MCP endpoint only, so
  // health checks from the container platform keep working.
  const GUARDED = [
    "/mcp",
    "/mcp-internal",
    "/readyz-internal",
    "/metrics-internal",
  ];
  if (cfg.allowedHosts?.length)
    app.use(GUARDED, hostHeaderValidation(cfg.allowedHosts));

  const limiter = new RateLimiter(cfg.rateLimit, cfg.rateWindowMs);
  app.use(GUARDED, (req: Request, res: Response, next: NextFunction) => {
    const retry = limiter.take(
      clientKey(req.headers, req.ip, cfg.clientIpHeader),
    );
    if (!retry) return next();
    res.set("Retry-After", String(retry));
    res.status(429).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Too many requests, try again shortly",
      },
      id: null,
    });
  });

  // Internal paths: 404 for a missing, wrong or unset token, so the route's existence is not confirmed.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const m = INTERNAL_PATH.exec(req.path);
    if (!m) return next();
    res.set("X-Robots-Tag", "noindex");
    if (!internalToken || !m[2] || !tokenMatches(m[2], internalToken)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    next();
  });

  app.get("/", (_req: Request, res: Response) => {
    res
      .type("text/plain")
      .send(`Ask Righto ${VERSION} MCP server. Endpoint: /mcp\n`);
  });
  // Liveness: never touches a database or any other dependency.
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true, version: VERSION });
  });
  // Readiness: 200 only when every registered check passes.
  app.get("/readyz", async (_req: Request, res: Response) => {
    const r = await runReadiness(flags.public);
    res
      .status(r.ok ? 200 : 503)
      .json({ ok: r.ok, version: VERSION, checks: r.checks });
  });
  // Internal readiness: every loaded vertical, reported separately, with any that failed to start.
  app.get("/readyz-internal/:token", async (_req: Request, res: Response) => {
    const r = await runReadiness(flags.loaded);
    const failed = failedVerticals();
    res.status(r.ok && Object.keys(failed).length === 0 ? 200 : 503).json({
      ok: r.ok,
      version: VERSION,
      checks: r.checks,
      failedVerticals: failed,
    });
  });
  // Outcome counts only: no arguments, results, course ids or identities (see src/core/metrics.ts).
  app.get("/metrics-internal/:token", (_req: Request, res: Response) => {
    res.type("text/plain").send(metricsText());
  });

  // Stateless: a fresh server and transport per request, no sessions.
  const serve =
    (set: ReturnType<typeof setFor>, route: string) =>
    async (req: Request, res: Response) => {
      const server = createServer(set.tools, {
        route,
        instructions: set.instructions,
      });
      const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        // Log the error only, never the request body (it can hold personal data).
        console.error(
          "MCP error:",
          error instanceof Error ? error.message : error,
        );
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    };
  app.all("/mcp", serve(publicSet, "public"));
  app.all("/mcp-internal/:token", serve(internalSet, "internal"));

  // Body parser errors (oversized or malformed JSON): answer without echoing or logging the body.
  app.use(
    (
      err: { status?: number },
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (res.headersSent) return next(err);
      const status = err.status === 413 ? 413 : err.status === 400 ? 400 : 500;
      const message =
        status === 413
          ? `Request body over ${cfg.bodyLimit}`
          : status === 400
            ? "Invalid JSON"
            : "Internal server error";
      res.status(status).json({
        jsonrpc: "2.0",
        error: { code: status === 500 ? -32603 : -32700, message },
        id: null,
      });
    },
  );

  const httpServer = app.listen(port, host, () => {
    console.log(
      `Ask Righto ${VERSION} listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}/mcp`,
    );
  });
  const shutdown = () =>
    httpServer.close(() => void stopVerticals().finally(() => process.exit(0)));
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
                       load or refresh energy plans; --record saves raw API responses as fixtures
  askrighto courses:validate | courses:load [--cricos FILE.csv] | courses:check-pages
  askrighto vce:validate | vce:load
                       check and load the Victorian course index and VCE admissions data from data/
  askrighto health:validate|health:load --dir UNZIPPED_FOLDER [--source-date YYYY-MM-DD] [--source-name NAME]  |  health:rates-validate
  askrighto intl:validate|intl:load --cricos COURSES.csv [--course-locations FILE.csv] [--institutions FILE.csv] [--source-date YYYY-MM-DD]
                       check and load the CRICOS course sheet (international students)
  askrighto compare:usecases [--json]
                       coverage report for the domestic and international course data (read-only)
  askrighto homeloans:sync [--record DIR] [--lender SLUG]
                       load or refresh home loans from lenders' CDR product data
  askrighto homeloans:cash-rate --date YYYY-MM-DD --value PERCENT --source URL
                       record the RBA cash rate target (re-keyed from the RBA page, with its link)
  askrighto report:homeloans [--json]
                       coverage and freshness report for the home loan data (read-only)
  askrighto renormalise-energy [--retailer SLUG] [--dry-run] [--show REASON]
                       re-run the normaliser over stored raw payloads (no API calls); --show prints
                       the raw fragment of plans still flagged with that reason`);
  } else if (args[0] === "migrate") {
    await (await import("./energy/cli.js")).cliMigrate();
  } else if (args[0]?.startsWith("courses:") || args[0]?.startsWith("vce:")) {
    const cli = await import("./courses/cli.js");
    const map: Record<string, () => unknown> = {
      "courses:validate": () => cli.cliCoursesValidate(),
      "courses:load": () => cli.cliCoursesLoad(args.slice(1)),
      "courses:check-pages": () => cli.cliCoursesCheckPages(),
      "vce:validate": () => cli.cliVceValidate(),
      "vce:load": () => cli.cliVceLoad(),
    };
    const run = map[args[0]];
    if (!run) throw new Error(`Unknown command ${args[0]}`);
    await run();
  } else if (args[0]?.startsWith("health:")) {
    const cli = await import("./health/cli.js");
    if (args[0] === "health:validate") await cli.cliHealthValidate(args.slice(1));
    else if (args[0] === "health:load") await cli.cliHealthLoad(args.slice(1));
    else if (args[0] === "health:rates-validate") cli.cliHealthRatesValidate();
  } else if (args[0]?.startsWith("intl:")) {
    const cli = await import("./intl/cli.js");
    if (args[0] === "intl:validate") cli.cliIntlValidate(args.slice(1));
    else if (args[0] === "intl:load") await cli.cliIntlLoad(args.slice(1));
    else throw new Error(`Unknown command ${args[0]}`);
  } else if (args[0] === "compare:usecases") {
    await (await import("./compare/cli.js")).cliCompareUseCases(args.slice(1));
  } else if (args[0] === "homeloans:sync" || args[0] === "homeloans:cash-rate" || args[0] === "report:homeloans") {
    const cli = await import("./homeloans/cli.js");
    if (args[0] === "homeloans:sync") await cli.cliHomeLoanSync(args.slice(1));
    else if (args[0] === "homeloans:cash-rate") await cli.cliCashRate(args.slice(1));
    else await cli.cliHomeLoanReport(args.slice(1));
  } else if (args[0] === "sync-energy") {
    await (await import("./energy/cli.js")).cliSyncEnergy(args.slice(1));
  } else if (args[0] === "renormalise-energy") {
    await (await import("./energy/cli.js")).cliRenormaliseEnergy(args.slice(1));
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
