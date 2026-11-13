import type { AnyToolDefinition } from "../core/define-tool.js";
import { listDataSources } from "./list-data-sources.js";

/** Every tool the server exposes. Verticals add theirs here. */
export const allTools: readonly AnyToolDefinition[] = [listDataSources];
