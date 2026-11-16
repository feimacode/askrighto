/** Reading, validating and loading the VCE admissions files. Scaling and groupings come from a permitted file or the git-ignored data/local copy. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Db } from "../energy/db.js";
import { loadStudies, type StudyCatalogue } from "../courses/studies.js";
import type {
  EarlyEntryScheme,
  Groupings,
  KeyDateYear,
  PreferenceRule,
  ScalingTable,
  VceData,
  VceSource,
} from "./types.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NAME_FIX: Record<string, string> = {
  "Data Analytics": "Applied Computing: Data Analytics",
  "Software Development": "Applied Computing: Software Development",
};

interface LocalJson {
  sourceUrl: string;
  studies: Array<{
    subject_name: string;
    scaled_at_raw: Record<string, number>;
  }>;
  groups: Array<{ group: string; subjects: string[] }>;
}

export interface VceFiles {
  data: Omit<VceData, "loadedAt">;
  errors: string[];
}

function studyIdByName(cat: StudyCatalogue, name: string): string | undefined {
  const n = NAME_FIX[name] ?? name;
  return cat.studies.find((s) => s.name === n)?.id;
}

/** Reads scaling-YYYY.json and study-groupings-YYYY.json files from the given sub-folders of dir. */
export function readTables(
  dir: string,
  subdirs: readonly string[],
  cat: StudyCatalogue,
  errors: string[],
): { scaling: ScalingTable[]; groupings: Groupings[] } {
  const scaling: ScalingTable[] = [];
  const groupings: Groupings[] = [];
  for (const sub of subdirs) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      const m = /^(scaling|study-groupings)-(\d{4})\.json$/.exec(f);
      if (!m) continue;
      const year = Number(m[2]);
      const json = JSON.parse(readFileSync(join(d, f), "utf8")) as LocalJson;
      if (m[1] === "scaling") {
        const studies: ScalingTable["studies"] = [];
        for (const s of json.studies as Array<{
          subject_name: string;
          scaled_at_raw: Record<string, number>;
        }>) {
          const id = studyIdByName(cat, s.subject_name);
          if (!id) {
            errors.push(`${f}: unknown study "${s.subject_name}"`);
            continue;
          }
          studies.push({
            studyId: id,
            name: s.subject_name,
            points: Object.entries(s.scaled_at_raw).map(
              ([r, v]) => [Number(r), Number(v)] as [number, number],
            ),
          });
        }
        scaling.push({ studyYear: year, sourceUrl: json.sourceUrl, studies });
      } else {
        const groupOf: Record<string, string> = {};
        for (const g of json.groups as Array<{
          group: string;
          subjects: string[];
        }>)
          for (const n of g.subjects) {
            const id = studyIdByName(cat, n);
            if (id) groupOf[id] = g.group;
          }
        groupings.push({
          studyYear: year,
          sourceUrl: json.sourceUrl,
          groupOf,
          englishGroup: "English studies",
        });
      }
    }
  }
  return { scaling, groupings };
}

export function readVceFiles(
  dir: string,
  cat: StudyCatalogue = loadStudies(dir),
): VceFiles {
  const errors: string[] = [];
  const read = (f: string) =>
    parse(readFileSync(join(dir, "vce", f), "utf8")) as Record<string, unknown>;

  const keyDates = (
    (read("key-dates.yaml").admissionsYears as KeyDateYear[]) ?? []
  ).map((y) => ({
    ...y,
    dates: y.dates.map((d) => ({
      ...d,
      date: String(d.date),
      ...(d.endDate ? { endDate: String(d.endDate) } : {}),
      checkedOn: String(d.checkedOn),
    })),
  }));
  for (const y of keyDates)
    for (const d of y.dates) {
      if (!ISO.test(d.date) || !ISO.test(d.checkedOn) || !d.sourceUrl)
        errors.push(
          `key date ${y.year}/${d.key}: needs a date, checkedOn and sourceUrl`,
        );
      if (d.issuingBody !== "VCAA" && d.issuingBody !== "VTAC")
        errors.push(
          `key date ${y.year}/${d.key}: issuingBody must be VCAA or VTAC`,
        );
    }
  const prefDoc = read("preference-rules.yaml");
  const preferenceRules = ((prefDoc.rules as PreferenceRule[]) ?? []).map(
    (r) => ({ ...r, checkedOn: String(r.checkedOn) }),
  );
  for (const r of preferenceRules)
    if (!r.sourceUrl || !ISO.test(r.checkedOn))
      errors.push(`preference rule ${r.id}: needs sourceUrl and checkedOn`);
  const earlyEntry = (
    (read("early-entry.yaml").schemes as EarlyEntryScheme[]) ?? []
  ).map((s) => ({ ...s, checkedOn: String(s.checkedOn) }));
  for (const s of earlyEntry) {
    if ("eligibility" in s || "eligible" in s)
      errors.push(
        `early entry ${s.id}: schemes must not carry an eligibility field`,
      );
    if (!s.sourceUrl || !ISO.test(s.checkedOn))
      errors.push(`early entry ${s.id}: needs sourceUrl and checkedOn`);
  }

  const { scaling, groupings } = readTables(dir, ["vce", "local"], cat, errors);
  return {
    data: {
      keyDates,
      preferenceRules,
      preferenceRulesYear: prefDoc.admissionsYear as number | undefined,
      earlyEntry,
      scaling,
      groupings,
    },
    errors,
  };
}

export async function loadVce(
  db: Db,
  files: VceFiles["data"],
  gitSha?: string,
): Promise<void> {
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "DELETE FROM vce_key_dates; DELETE FROM vce_preference_rules; DELETE FROM vce_early_entry; DELETE FROM vce_scaling; DELETE FROM vce_study_groupings",
    );
    for (const y of files.keyDates)
      for (const d of y.dates)
        await c.query("INSERT INTO vce_key_dates VALUES ($1,$2,$3)", [
          y.year,
          d.key,
          JSON.stringify(d),
        ]);
    for (const r of files.preferenceRules)
      await c.query("INSERT INTO vce_preference_rules VALUES ($1,$2)", [
        r.id,
        JSON.stringify({ ...r, admissionsYear: files.preferenceRulesYear }),
      ]);
    for (const s of files.earlyEntry)
      await c.query("INSERT INTO vce_early_entry VALUES ($1,$2,$3,$4)", [
        s.id,
        s.university,
        s.admissionsYear,
        JSON.stringify(s),
      ]);
    for (const t of files.scaling)
      for (const s of t.studies)
        await c.query("INSERT INTO vce_scaling VALUES ($1,$2,$3)", [
          t.studyYear,
          s.studyId,
          JSON.stringify({ ...s, sourceUrl: t.sourceUrl }),
        ]);
    for (const g of files.groupings)
      await c.query("INSERT INTO vce_study_groupings VALUES ($1,$2)", [
        g.studyYear,
        JSON.stringify(g),
      ]);
    const counts: Record<string, number> = {
      "vce-key-dates": files.keyDates.reduce((n, y) => n + y.dates.length, 0),
      "vtac-preference-rules": files.preferenceRules.length,
      "vic-early-entry": files.earlyEntry.length,
      "vce-scaling": files.scaling.reduce((n, t) => n + t.studies.length, 0),
      "vce-study-groupings": files.groupings.length,
    };
    for (const [dataset, n] of Object.entries(counts))
      await c.query(
        "INSERT INTO vce_loads (dataset, git_sha, row_count) VALUES ($1,$2,$3)",
        [dataset, gitSha ?? null, n],
      );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export class VceStore implements VceSource {
  private cached: { at: number; data: VceData } | undefined;
  constructor(
    private db: Db,
    private ttlMs = 5 * 60_000,
  ) {}
  clear(): void {
    this.cached = undefined;
  }
  async data(): Promise<VceData> {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs)
      return this.cached.data;
    const q = this.db.pool;
    const [kd, pr, ee, sc, gr, ld] = await Promise.all([
      q.query(
        "SELECT admissions_year, doc FROM vce_key_dates ORDER BY admissions_year, doc->>'date'",
      ),
      q.query("SELECT doc FROM vce_preference_rules ORDER BY id"),
      q.query("SELECT doc FROM vce_early_entry ORDER BY university, id"),
      q.query("SELECT study_year, doc FROM vce_scaling ORDER BY study_year"),
      q.query("SELECT doc FROM vce_study_groupings"),
      q.query("SELECT max(loaded_at) AS at FROM vce_loads"),
    ]);
    if (!ld.rows[0]?.at) throw new Error("no VCE load recorded");
    const years = new Map<number, KeyDateYear>();
    for (const r of kd.rows)
      years.set(r.admissions_year, {
        year: r.admissions_year,
        dates: [...(years.get(r.admissions_year)?.dates ?? []), r.doc],
      });
    const tables = new Map<number, ScalingTable>();
    for (const r of sc.rows) {
      const t: ScalingTable = tables.get(r.study_year) ?? {
        studyYear: r.study_year,
        sourceUrl: r.doc.sourceUrl,
        studies: [],
      };
      t.studies.push({
        studyId: r.doc.studyId,
        name: r.doc.name,
        points: r.doc.points,
      });
      tables.set(r.study_year, t);
    }
    const data: VceData = {
      keyDates: [...years.values()],
      preferenceRules: pr.rows.map((r) => r.doc),
      ...(pr.rows[0]?.doc.admissionsYear
        ? { preferenceRulesYear: pr.rows[0].doc.admissionsYear }
        : {}),
      earlyEntry: ee.rows.map((r) => r.doc),
      scaling: [...tables.values()],
      groupings: gr.rows.map((r) => r.doc),
      loadedAt: ld.rows[0].at,
    };
    this.cached = { at: Date.now(), data };
    return data;
  }
}
