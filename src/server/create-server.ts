import { registerInkview } from "@feimacode/inkview-sdk";
import { McpServer } from "@modelcontextprotocol/server";
import { registerTools, type AnyToolDefinition } from "../core/define-tool.js";
import { allTools } from "../tools/index.js";
import { VERSION } from "../version.js";
import { serverInstructions } from "./instructions.js";

export interface RouteOptions {
  /** Route name for counters: "public" or "internal". */
  route?: string;
  /** Vertical guidance for the initialize instructions. Defaults to energy. */
  instructions?: readonly string[];
}

export function createServer(
  tools: readonly AnyToolDefinition[] = allTools,
  opts: RouteOptions = {},
): McpServer {
  const server = new McpServer(
    { name: "askrighto", version: VERSION },
    { instructions: serverInstructions(opts.instructions) },
  );
  registerInkview(server);
  registerTools(server, tools, { route: opts.route ?? "public" });
  return server;
}
