/** The energy journeys: one source file each (`<id>.md`), served as a plugin skill and by get_energy_guide. */
import { ENERGY_JOURNEYS } from "./journeys.generated.js";

export const JOURNEY_IDS = ["energy-start", "energy-current-plan", "energy-readings", "energy-compare", "energy-plan-rates"] as const;
export type JourneyId = (typeof JOURNEY_IDS)[number];

export const journeyBody = (id: JourneyId): string => ENERGY_JOURNEYS[id].body;
export const journeyDescription = (id: JourneyId): string => ENERGY_JOURNEYS[id].description;
export { ENERGY_JOURNEYS };
