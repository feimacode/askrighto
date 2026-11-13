import { McpServer } from "@modelcontextprotocol/server";
import { registerTools, type AnyToolDefinition } from "../core/define-tool.js";
import { allTools } from "../tools/index.js";
import { VERSION } from "../version.js";
import { serverInstructions } from "./instructions.js";

export function createServer(tools: readonly AnyToolDefinition[] = allTools): McpServer {
  const server = new McpServer({ name: "askrighto", version: VERSION }, { instructions: serverInstructions() });
  registerTools(server, tools);
  return server;
}
