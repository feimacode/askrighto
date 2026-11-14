import type { AnyToolDefinition } from "../core/define-tool.js";
import { compareEnergyPlans } from "./compare-energy-plans.js";
import { getEnergyPlan } from "./get-energy-plan.js";
import { listDataSources } from "./list-data-sources.js";
import { searchEnergyPlans } from "./search-energy-plans.js";

/** Every tool the server exposes. Verticals add theirs here. */
export const allTools: readonly AnyToolDefinition[] = [searchEnergyPlans, getEnergyPlan, compareEnergyPlans, listDataSources];
