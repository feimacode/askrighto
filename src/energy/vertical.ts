import type { Vertical } from "../verticals.js";
import { compareEnergyPlanRates } from "../tools/compare-energy-plan-rates.js";
import { compareEnergyPlans } from "../tools/compare-energy-plans.js";
import { getEnergyGuide } from "../tools/get-energy-guide.js";
import { getEnergyPlan } from "../tools/get-energy-plan.js";
import { listCurrentPlanOptions } from "../tools/list-current-plan-options.js";
import { getReadingsUploadLink } from "../tools/get-readings-upload-link.js";
import { searchEnergyPlans } from "../tools/search-energy-plans.js";
import { summariseIntervalReadings } from "../tools/summarise-interval-readings.js";
import { startEnergy } from "./index.js";
import { ENERGY_INSTRUCTIONS } from "./instructions.js";

export const energyVertical: Vertical = {
  id: "energy",
  tools: [searchEnergyPlans, getEnergyPlan, compareEnergyPlans, compareEnergyPlanRates, summariseIntervalReadings, listCurrentPlanOptions, getReadingsUploadLink, getEnergyGuide],
  instructions: ENERGY_INSTRUCTIONS,
  async start(env) {
    const rt = await startEnergy(env);
    return rt ? () => rt.stop() : undefined;
  },
};
