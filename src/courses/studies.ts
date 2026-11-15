/** VCE study names: loading data/vce-studies.yaml and matching what a student types to a study. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

export interface Study {
  id: string;
  name: string;
  aliases: string[];
  codes: string[];
}
export interface StudyGroup {
  id: string;
  name: string;
  members: string[];
}
export interface StudyCatalogue {
  studies: Study[];
  groups: StudyGroup[];
}

export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.ASKRIGHTO_DATA_DIR
    ? resolve(env.ASKRIGHTO_DATA_DIR)
    : resolve(process.cwd(), "data");
}

export function parseStudies(text: string): StudyCatalogue {
  const raw = parse(text) as { studies?: Study[]; groups?: StudyGroup[] };
  const studies = (raw.studies ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    aliases: s.aliases ?? [],
    codes: s.codes ?? [],
  }));
  const groups = raw.groups ?? [];
  const ids = new Set<string>();
  for (const s of studies) {
    if (!s.id || !s.name) throw new Error("every study needs an id and a name");
    if (ids.has(s.id)) throw new Error(`duplicate study id ${s.id}`);
    ids.add(s.id);
  }
  for (const g of groups) {
    if (ids.has(g.id))
      throw new Error(`group id ${g.id} clashes with a study id`);
    for (const m of g.members)
      if (!ids.has(m))
        throw new Error(`group ${g.id} names unknown study ${m}`);
  }
  return { studies, groups };
}

let cached: StudyCatalogue | undefined;
export function loadStudies(dir = dataDir()): StudyCatalogue {
  if (!cached)
    cached = parseStudies(
      readFileSync(resolve(dir, "vce-studies.yaml"), "utf8"),
    );
  return cached;
}
export function resetStudiesCache(): void {
  cached = undefined;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type StudyMatch =
  | { ok: true; study: Study }
  | { ok: false; candidates: Study[] };

/** Matches a VCAA name, a short name or a code. Ambiguous or unknown input returns candidates, never a guess. */
export function matchStudy(
  input: string,
  cat: StudyCatalogue = loadStudies(),
): StudyMatch {
  const q = norm(input);
  if (!q) return { ok: false, candidates: [] };
  const exact = cat.studies.filter(
    (s) =>
      norm(s.name) === q ||
      s.aliases.some((a) => norm(a) === q) ||
      s.codes.some((c) => norm(c) === q),
  );
  if (exact.length === 1) return { ok: true, study: exact[0]! };
  if (exact.length > 1) return { ok: false, candidates: exact };
  const qt = q.replace(/\bmaths?\b/g, "math").split(" ");
  const partial = cat.studies.filter((s) => {
    const name = norm(s.name);
    const nt = name.split(" ");
    return name.includes(q) || q.includes(name) || qt.every((t) => nt.some((w) => w.startsWith(t)));
  });
  if (partial.length === 1 && q.length >= 4)
    return { ok: true, study: partial[0]! };
  return { ok: false, candidates: partial.slice(0, 8) };
}

/** The study ids a requirement id stands for: the study itself, or all members of a group. */
export function expandStudyId(
  id: string,
  cat: StudyCatalogue = loadStudies(),
): string[] {
  const g = cat.groups.find((x) => x.id === id);
  return g ? g.members : [id];
}
export function isKnownStudyId(
  id: string,
  cat: StudyCatalogue = loadStudies(),
): boolean {
  return (
    cat.studies.some((s) => s.id === id) || cat.groups.some((g) => g.id === id)
  );
}
