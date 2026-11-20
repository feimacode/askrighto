import type { AnyToolDefinition } from "../core/define-tool.js";
import { compareEnergyPlans } from "./compare-energy-plans.js";
import { getEnergyPlan } from "./get-energy-plan.js";
import { getReadingsUploadLink } from "./get-readings-upload-link.js";
import { listDataSources } from "./list-data-sources.js";
import { listCurrentPlanOptions } from "./list-current-plan-options.js";
import { searchEnergyPlans } from "./search-energy-plans.js";
import { summariseIntervalReadings } from "./summarise-interval-readings.js";

/** Every tool the server exposes. Verticals add theirs here. */
export const allTools: readonly AnyToolDefinition[] = [
  searchEnergyPlans,
  getEnergyPlan,
  compareEnergyPlans,
  summariseIntervalReadings,
  listCurrentPlanOptions,
  getReadingsUploadLink,
  listDataSources,
];
