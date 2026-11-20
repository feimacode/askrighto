import type { Vertical } from "../verticals.js";
import { compareEnergyPlans } from "../tools/compare-energy-plans.js";
import { getEnergyPlan } from "../tools/get-energy-plan.js";
import { listCurrentPlanOptions } from "../tools/list-current-plan-options.js";
import { searchEnergyPlans } from "../tools/search-energy-plans.js";
import { summariseIntervalReadings } from "../tools/summarise-interval-readings.js";
import { startEnergy } from "./index.js";
import { ENERGY_INSTRUCTIONS } from "./instructions.js";

export const energyVertical: Vertical = {
  id: "energy",
  tools: [searchEnergyPlans, getEnergyPlan, compareEnergyPlans, summariseIntervalReadings, listCurrentPlanOptions],
  instructions: ENERGY_INSTRUCTIONS,
  async start(env) {
    const rt = await startEnergy(env);
    return rt ? () => rt.stop() : undefined;
  },
};
