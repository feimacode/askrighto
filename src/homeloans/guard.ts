/**
 * Start-up guard: in production the `home-loans` vertical may be public only when the legal view marker
 * exists (docs/legal/home-loans-view.md, naming a reviewer, a date and a scope). The file is evidence, not
 * security: it stops a settings slip, it cannot judge the view. See add-home-loan-promotion-gates.
 */
import { existsSync, readFileSync } from "node:fs";
import { isProduction } from "../core/rights.js";

export const LEGAL_MARKER = "docs/legal/home-loans-view.md";

export function legalMarkerProblem(text: string): string | undefined {
  const field = (name: string) => new RegExp(`^${name}:\\s*(\\S.*)$`, "im").exec(text)?.[1]?.trim();
  for (const f of ["Reviewer", "Date", "Scope"]) if (!field(f)) return `missing a "${f}:" line`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(field("Date")!)) return `"Date:" must be YYYY-MM-DD`;
  return undefined;
}

/** Throws when the rule is broken. Returns the scope (tool names) the marker covers, if it lists them. */
export function assertHomeLoanPublicGuard(publicIds: readonly string[], env: NodeJS.ProcessEnv = process.env): void {
  if (!publicIds.includes("home-loans") || !isProduction(env)) return;
  const path = env.ASKRIGHTO_HOME_LOAN_LEGAL_FILE ?? LEGAL_MARKER;
  if (!existsSync(path))
    throw new Error(`"home-loans" is public in production but ${path} does not exist. Record the legal view first (docs/promotion-checklist.md).`);
  const problem = legalMarkerProblem(readFileSync(path, "utf8"));
  if (problem) throw new Error(`${path} is not a valid legal view marker: ${problem}`);
}
