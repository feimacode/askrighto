import type { Vertical } from "../verticals.js";
import {
  checkCoursePrerequisites,
  compareCourses,
  getCourse,
  searchCourses,
} from "../tools/course-tools.js";
import {
  estimateVceAggregate,
  getSubjectScaling,
  getVceKeyDates,
  listEarlyEntrySchemes,
} from "../tools/planning-tools.js";
import { COURSE_INSTRUCTIONS } from "./instructions.js";
import { startCourses } from "./index.js";

export const coursesVertical: Vertical = {
  id: "courses",
  tools: [
    searchCourses,
    getCourse,
    compareCourses,
    checkCoursePrerequisites,
    getSubjectScaling,
    estimateVceAggregate,
    getVceKeyDates,
    listEarlyEntrySchemes,
  ],
  instructions: COURSE_INSTRUCTIONS,
  start: (env) => startCourses(env),
};
