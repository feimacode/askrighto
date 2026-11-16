import type { Vertical } from "../verticals.js";
import {
  checkIntlEntryChecklist,
  compareIntlCourses,
  getIntlCourse,
  searchIntlCourses,
} from "../tools/intl-tools.js";
import { INTL_INSTRUCTIONS } from "./instructions.js";
import { startIntl } from "./index.js";

export const internationalVertical: Vertical = {
  id: "international",
  tools: [
    searchIntlCourses,
    getIntlCourse,
    compareIntlCourses,
    checkIntlEntryChecklist,
  ],
  instructions: INTL_INSTRUCTIONS,
  start: (env) => startIntl(env),
};
