/** Which verticals exist in this build, and the per-route sets built from the flags. */
import { coursesVertical } from "../courses/vertical.js";
import { internationalVertical } from "../intl/vertical.js";
import { homeLoansVertical } from "../homeloans/vertical.js";
import { healthVertical } from "../health/vertical.js";
import { careersVertical } from "../careers/vertical.js";
import { energyVertical } from "../energy/vertical.js";
import { routeSet, type Vertical } from "../verticals.js";

export const ALL_VERTICALS: readonly Vertical[] = [
  energyVertical,
  coursesVertical,
  internationalVertical,
  homeLoansVertical,
  healthVertical,
  careersVertical,
];

export function setFor(ids: readonly string[]) {
  return routeSet(ALL_VERTICALS, ids);
}
