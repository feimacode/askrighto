import type { Vertical } from "../verticals.js";
import { CAREER_TOOLS } from "../tools/career-tools.js";
import { CAREER_INSTRUCTIONS } from "./instructions.js";
import { startCareers } from "./index.js";

export const careersVertical: Vertical = {
  id: "career-outcomes",
  tools: CAREER_TOOLS,
  instructions: CAREER_INSTRUCTIONS,
  start: (env) => startCareers(env),
};
