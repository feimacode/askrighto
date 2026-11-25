import { z } from "zod";
import { PUBLIC_URL } from "../config.js";
import { defineTool } from "../core/define-tool.js";
import { found } from "../core/grounded.js";
import { JOURNEY_IDS, journeyBody, journeyDescription } from "../guidance/energy/index.js";
import { NOTICE } from "./energy-common.js";

/** The date the guidance text last changed. It holds no figures, so this is a version date, not a data date. */
export const GUIDE_AS_OF = "2026-11-25T00:00:00Z";


/**
 * For hosts without the plugin: returns the same steps as the energy skill of that name, from the same source file
 * (src/guidance/energy/<journey>.md). Guidance only; it holds no facts, so every figure still comes from a data tool.
 */
export const getEnergyGuide = defineTool({
  name: "get_energy_guide",
  title: "Get the steps for an energy journey",
  description:
    "Returns the steps for one energy journey as text: energy-start (home or business, invoice, postcode), energy-current-plan (read the invoice, pick the current plan), energy-readings (interval readings), energy-compare (usage source, cost comparison, baseline) or energy-plan-rates (named plans, no usage). Call it at the start of an energy conversation when no Ask Righto energy skill is loaded. Holds no figures.",
  inputSchema: z.object({ journey: z.enum(JOURNEY_IDS).describe("Which journey's steps to return") }),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: (args) =>
    found({
      data: { journey: args.journey, whenToUse: journeyDescription(args.journey), steps: journeyBody(args.journey), notice: NOTICE },
      source: { name: "Ask Righto energy guidance", url: PUBLIC_URL, licence: "Guidance text written by Ask Righto; it holds no figures" },
      asOf: GUIDE_AS_OF,
    }),
  render: (d) => `${d.steps}\n${d.notice}`,
});
