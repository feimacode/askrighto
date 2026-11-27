import { HOME_LOAN_TOOLS } from "../tools/home-loan-tools.js";
import type { Vertical } from "../verticals.js";
import { HOME_LOAN_INSTRUCTIONS } from "./instructions.js";

/** Index-only: no data to load, so start does nothing. */
export const homeLoansVertical: Vertical = {
  id: "home-loans",
  tools: HOME_LOAN_TOOLS,
  instructions: HOME_LOAN_INSTRUCTIONS,
  start: async () => undefined,
};
