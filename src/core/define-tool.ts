/**
 * Tool definition and registration. Every tool goes through `defineTool` /
 * `registerTools`, which refuse a tool the directories would reject and force
 * the handler to return a Grounded result (found with source and date, or not found).
 */
import { z } from "zod";
import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import { renderText, type Grounded } from "./grounded.js";
import { staleWarnings } from "./registry.js";

/** Verbs a tool name may start with. Verb-first names are required by the OpenAI and Google guidelines. */
export const TOOL_VERBS = ["get", "list", "search", "find", "compare", "estimate", "check", "calculate", "explain"] as const;

export interface ToolDefinition<S extends z.ZodObject<z.ZodRawShape>, T> {
  /** snake_case, verb first, e.g. `search_energy_plans`. */
  name: string;
  title: string;
  description: string;
  /** A flat object schema: scalars, enums and arrays of scalars only. */
  inputSchema: S;
  /** Every tool is read-only. Spelled out so a reviewer sees it in each definition. */
  readOnlyHint: true;
  destructiveHint: false;
  /** Whether the tool reaches outside the server's own data. False for lookups in our stored datasets. */
  openWorldHint: boolean;
  /** Dataset ids (see registry) this tool reads, used to add staleness warnings. */
  datasets?: readonly string[];
  handler: (args: z.infer<S>) => Promise<Grounded<T>> | Grounded<T>;
  /** Text body for a found result. The source footer and warnings are added for you. */
  render: (data: T, args: z.infer<S>) => string;
  /** Optional extras (for example UI metadata) merged into the tool result. */
  decorate?: (result: Grounded<T>, args: z.infer<S>) => Partial<CallToolResult> | undefined;
  /** Optional metadata on the tool listing (for example the Inkview resource link). */
  meta?: Record<string, unknown>;
}

// The generic parameters are erased for storage in a list of tools.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, any>;

export function defineTool<S extends z.ZodObject<z.ZodRawShape>, T>(def: ToolDefinition<S, T>): ToolDefinition<S, T> {
  return def;
}

const SCALARS = new Set(["string", "number", "integer", "boolean"]);

function isScalarSchema(s: Record<string, unknown>): boolean {
  if (typeof s.type === "string" && SCALARS.has(s.type)) return true;
  if (Array.isArray(s.enum) || "const" in s) return true;
  if (Array.isArray(s.anyOf)) {
    return (s.anyOf as Record<string, unknown>[]).every((b) => b.type === "null" || isScalarSchema(b));
  }
  return false;
}

/** Throws a readable error if the tool breaks a rule. */
export function validateToolDefinition(def: AnyToolDefinition): void {
  const fail = (why: string): never => {
    throw new Error(`Tool "${def.name}": ${why}`);
  };
  if (!/^[a-z]+(_[a-z0-9]+)+$/.test(def.name)) fail("name must be snake_case with at least two words");
  const verb = def.name.split("_")[0] as string;
  if (!(TOOL_VERBS as readonly string[]).includes(verb)) fail(`name must start with a verb (${TOOL_VERBS.join(", ")})`);
  if (!def.title?.trim()) fail("title is required");
  if (!def.description?.trim()) fail("description is required");
  if (def.readOnlyHint !== true) fail("readOnlyHint must be true (all tools are read-only)");
  if (def.destructiveHint !== false) fail("destructiveHint must be false");
  if (typeof def.openWorldHint !== "boolean") fail("openWorldHint must be set explicitly");

  const json = z.toJSONSchema(def.inputSchema) as { type?: string; properties?: Record<string, Record<string, unknown>> };
  if (json.type !== "object") fail("inputSchema must be an object schema");
  for (const [key, prop] of Object.entries(json.properties ?? {})) {
    if (prop.type === "array") {
      const items = prop.items as Record<string, unknown> | undefined;
      if (!items || !isScalarSchema(items)) fail(`input "${key}" must be a list of plain values (schemas are kept flat)`);
    } else if (!isScalarSchema(prop)) {
      fail(`input "${key}" must be a plain value, enum, or list of plain values (schemas are kept flat)`);
    }
  }
}

/** Registers tools on a server, validating each first. Throws on the first invalid tool. */
export function registerTools(server: McpServer, defs: readonly AnyToolDefinition[]): void {
  const seen = new Set<string>();
  for (const def of defs) {
    validateToolDefinition(def);
    if (seen.has(def.name)) throw new Error(`Tool "${def.name}" is defined twice`);
    seen.add(def.name);

    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: {
          title: def.title,
          readOnlyHint: def.readOnlyHint,
          destructiveHint: def.destructiveHint,
          openWorldHint: def.openWorldHint,
        },
        ...(def.meta ? { _meta: def.meta } : {}),
      },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        let result: Grounded<unknown>;
        try {
          result = await def.handler(args);
        } catch (error) {
          // Log the error only, never the arguments (they can hold personal details).
          console.error(`Tool ${def.name} failed:`, error instanceof Error ? error.message : "unknown error");
          return {
            isError: true,
            content: [{ type: "text", text: "Something went wrong looking that up. No figures were produced." }],
          };
        }
        if (result.found && def.datasets?.length) {
          const warnings = [...(result.warnings ?? []), ...staleWarnings(def.datasets)];
          result = { ...result, ...(warnings.length ? { warnings } : {}) };
        }
        const text = renderText(result, (data) => def.render(data, args));
        const extra = def.decorate?.(result, args) ?? {};
        return {
          content: [{ type: "text", text }],
          structuredContent: result as unknown as Record<string, unknown>,
          ...extra,
        };
      },
    );
  }
}
