import type { Vertical } from "../verticals.js";
import {
  getCourse,
  getVceAdmissionsSources,
  searchCourses,
} from "../tools/course-tools.js";
import { COURSE_INSTRUCTIONS } from "./instructions.js";
import { startCourses } from "./index.js";

export const coursesVertical: Vertical = {
  id: "courses-domestic",
  tools: [searchCourses, getCourse, getVceAdmissionsSources],
  instructions: COURSE_INSTRUCTIONS,
  start: (env) => startCourses(env),
};
