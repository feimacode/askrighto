import type { AnyToolDefinition } from "../core/define-tool.js";
import { HOME_LOAN_TOOLS } from "../tools/home-loan-tools.js";
import type { Vertical } from "../verticals.js";
import { startHomeLoans } from "./index.js";
import { HOME_LOAN_INSTRUCTIONS } from "./instructions.js";

/** `ASKRIGHTO_HOME_LOAN_TOOLS=a,b` limits which tools are registered (for example to ship the calculator dark). Unset means all. */
export function enabledHomeLoanTools(env: NodeJS.ProcessEnv = process.env): readonly AnyToolDefinition[] {
  const want = (env.ASKRIGHTO_HOME_LOAN_TOOLS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (want.length === 0) return HOME_LOAN_TOOLS;
  const unknown = want.filter((n) => !HOME_LOAN_TOOLS.some((t) => t.name === n));
  if (unknown.length) throw new Error(`ASKRIGHTO_HOME_LOAN_TOOLS names unknown tool(s): ${unknown.join(", ")}`);
  return HOME_LOAN_TOOLS.filter((t) => want.includes(t.name));
}

export const homeLoansVertical: Vertical = {
  id: "home-loans",
  tools: enabledHomeLoanTools(),
  instructions: HOME_LOAN_INSTRUCTIONS,
  start: (env) => startHomeLoans(env),
};
