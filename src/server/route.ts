/** Which verticals exist in this build, and the per-route sets built from the flags. */
import { energyVertical } from "../energy/vertical.js";
import { routeSet, type Vertical } from "../verticals.js";

export const ALL_VERTICALS: readonly Vertical[] = [energyVertical];

export function setFor(ids: readonly string[]) {
  return routeSet(ALL_VERTICALS, ids);
}
