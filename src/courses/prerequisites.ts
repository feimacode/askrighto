/** Evaluates structured prerequisite rules against a student's studies (and scores, if given). */
import { expandStudyId, loadStudies, type StudyCatalogue } from "./studies.js";
import type { Leaf, PrerequisiteBlock, Rule } from "./types.js";

export type PrereqStatus = "met" | "not_met" | "needs_scores";

export interface StudentStudy {
  studyId: string;
  /** Expected study score, when the student gave one. */
  score?: number;
}

export interface PrereqResult {
  status: PrereqStatus;
  /** What is missing or short, in words (only for not_met). */
  missing: string[];
  /** The minimum scores that could not be checked (only for needs_scores). */
  scoresNeeded: string[];
}

const EAL_ID = "english-as-an-additional-language";

function labelOf(id: string, cat: StudyCatalogue): string {
  return (
    cat.studies.find((s) => s.id === id)?.name ??
    cat.groups.find((g) => g.id === id)?.name ??
    id
  );
}

interface Node {
  status: PrereqStatus;
  missing: string[];
  needs: string[];
}

function evalRule(
  rule: Rule,
  studies: readonly StudentStudy[],
  eal: boolean,
  cat: StudyCatalogue,
): Node {
  if ("allOf" in rule) {
    const parts = rule.allOf.map((r) => evalRule(r, studies, eal, cat));
    const bad = parts.filter((p) => p.status === "not_met");
    if (bad.length)
      return {
        status: "not_met",
        missing: bad.flatMap((p) => p.missing),
        needs: [],
      };
    const need = parts.filter((p) => p.status === "needs_scores");
    return need.length
      ? {
          status: "needs_scores",
          missing: [],
          needs: need.flatMap((p) => p.needs),
        }
      : { status: "met", missing: [], needs: [] };
  }
  if ("anyOf" in rule) {
    const parts = rule.anyOf.map((r) => evalRule(r, studies, eal, cat));
    if (parts.some((p) => p.status === "met"))
      return { status: "met", missing: [], needs: [] };
    const need = parts.filter((p) => p.status === "needs_scores");
    if (need.length)
      return {
        status: "needs_scores",
        missing: [],
        needs: need.flatMap((p) => p.needs),
      };
    return {
      status: "not_met",
      missing: [`one of: ${parts.flatMap((p) => p.missing).join("; ")}`],
      needs: [],
    };
  }
  return evalLeaf(rule, studies, eal, cat);
}

function evalLeaf(
  leaf: Leaf,
  studies: readonly StudentStudy[],
  eal: boolean,
  cat: StudyCatalogue,
): Node {
  const members = expandStudyId(leaf.study, cat);
  const held = studies.filter((s) => members.includes(s.studyId));
  const label = labelOf(leaf.study, cat);
  if (held.length === 0)
    return { status: "not_met", missing: [label], needs: [] };
  let needsScore: string | undefined;
  let short: string | undefined;
  for (const s of held) {
    const min =
      leaf.ealMinScore !== undefined &&
      (s.studyId === EAL_ID || (eal && members.includes("english")))
        ? leaf.ealMinScore
        : leaf.minScore;
    if (min === undefined) return { status: "met", missing: [], needs: [] };
    if (s.score === undefined) {
      needsScore = `${labelOf(s.studyId, cat)} at least ${min}`;
      continue;
    }
    if (s.score >= min) return { status: "met", missing: [], needs: [] };
    short = `${labelOf(s.studyId, cat)} at least ${min} (given: ${s.score})`;
  }
  if (needsScore)
    return { status: "needs_scores", missing: [], needs: [needsScore] };
  return { status: "not_met", missing: [short ?? label], needs: [] };
}

export function evaluatePrerequisites(
  block: Pick<PrerequisiteBlock, "rules">,
  studies: readonly StudentStudy[],
  eal = false,
  cat: StudyCatalogue = loadStudies(),
): PrereqResult {
  const r = evalRule({ allOf: block.rules }, studies, eal, cat);
  return { status: r.status, missing: r.missing, scoresNeeded: r.needs };
}

/** Whether the studies could meet the rules at all if scores are ignored (used to filter search results). */
export function couldMeet(
  block: Pick<PrerequisiteBlock, "rules">,
  studies: readonly StudentStudy[],
  cat: StudyCatalogue = loadStudies(),
): boolean {
  const stripped = (r: Rule): Rule =>
    "allOf" in r
      ? { allOf: r.allOf.map(stripped) }
      : "anyOf" in r
        ? { anyOf: r.anyOf.map(stripped) }
        : { study: r.study };
  return (
    evaluatePrerequisites(
      { rules: block.rules.map(stripped) },
      studies,
      false,
      cat,
    ).status === "met"
  );
}
