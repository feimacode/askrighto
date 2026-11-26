/** Checks run before any CRICOS data replaces what is stored. Pure, so each rule is tested on its own. */
export const MIN_INTL_COURSES = 1000;
export const MAX_DROP = 0.2;

export interface GuardInput {
  /** Parser problems (a missing required column). Never overridden by force. */
  problems: string[];
  newIntlKept: number;
  prevIntlKept?: number;
  newDomesticCourses: number;
  prevDomesticCourses?: number;
  newSourceDate: string;
  prevSourceDate?: string;
  force?: boolean;
  /** Test hook: the floor for kept international courses. */
  minIntlCourses?: number;
}
export interface GuardResult {
  ok: boolean;
  /** What stopped the run (or what force overrode). */
  failures: string[];
  overridden: string[];
}

const drop = (now: number, before?: number) =>
  before !== undefined && before > 0 ? (before - now) / before : 0;

export function checkGuards(g: GuardInput): GuardResult {
  const hard = g.problems.map((p) => `CRICOS file: ${p}`);
  const soft: string[] = [];
  const floor = g.minIntlCourses ?? MIN_INTL_COURSES;
  if (g.newIntlKept < floor)
    soft.push(`only ${g.newIntlKept} international courses kept; the floor is ${floor}`);
  const di = drop(g.newIntlKept, g.prevIntlKept);
  if (di > MAX_DROP)
    soft.push(`international courses fell from ${g.prevIntlKept} to ${g.newIntlKept} (${Math.round(di * 100)} percent; the limit is ${MAX_DROP * 100})`);
  const dd = drop(g.newDomesticCourses, g.prevDomesticCourses);
  if (dd > MAX_DROP)
    soft.push(`domestic courses fell from ${g.prevDomesticCourses} to ${g.newDomesticCourses} (${Math.round(dd * 100)} percent; the limit is ${MAX_DROP * 100})`);
  if (g.prevSourceDate && g.newSourceDate < g.prevSourceDate)
    soft.push(`the file date ${g.newSourceDate} is older than the stored ${g.prevSourceDate}`);
  if (hard.length) return { ok: false, failures: [...hard, ...soft], overridden: [] };
  if (g.force) return { ok: true, failures: [], overridden: soft };
  return { ok: soft.length === 0, failures: soft, overridden: [] };
}
