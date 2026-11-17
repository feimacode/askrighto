import type { Vertical } from "../verticals.js";
import { HEALTH_TOOLS } from "../tools/health-tools.js";
import { HEALTH_INSTRUCTIONS } from "./instructions.js";
import { startHealth } from "./index.js";

export const healthVertical: Vertical = {
  id: "health-cover",
  tools: HEALTH_TOOLS,
  instructions: HEALTH_INSTRUCTIONS,
  start: (env) => startHealth(env),
};
