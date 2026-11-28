import type { Vertical } from "../verticals.js";
import {
  getCourse,
  getAdmissionsSources,
  searchCourses,
} from "../tools/course-tools.js";
import { COURSE_INSTRUCTIONS } from "./instructions.js";
import { startCourses } from "./index.js";

export const coursesVertical: Vertical = {
  id: "courses-domestic",
  tools: [searchCourses, getCourse, getAdmissionsSources],
  instructions: COURSE_INSTRUCTIONS,
  start: (env) => startCourses(env),
};
