/** Parsing and validation of the per-university course YAML (rules in add-vic-course-data design, decision 7). */
import { parse } from "yaml";
import { rightsFor } from "../core/rights.js";
import {
  CRITERION_KINDS,
  FIGURE_KINDS,
  type Course,
  type EntryFigure,
  type OtherCriterion,
  type PrerequisiteBlock,
  type Provider,
  type ProviderFile,
  type Rule,
} from "./types.js";
import { bannedIn } from "./notice.js";
import { isKnownStudyId, loadStudies, type StudyCatalogue } from "./studies.js";

const GOV_DOMAINS = ["education.gov.au", "data.gov.au", "vcaa.vic.edu.au"];
const TAC = [
  { host: "vtac.edu.au", rights: "vtac-coursesearch" },
  { host: "courseseeker.edu.au", rights: "course-seeker" },
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidateOptions {
  now?: Date;
  studies?: StudyCatalogue;
  file?: string;
}

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
};
const onDomain = (host: string, domains: readonly string[]) =>
  domains.some((d) => host === d || host.endsWith("." + d));

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Parses one provider file. Returns the courses and every problem found (an empty list means valid). */
export function parseProviderFile(
  text: string,
  opts: ValidateOptions = {},
): { file?: ProviderFile; errors: string[] } {
  const now = opts.now ?? new Date();
  const studies = opts.studies ?? loadStudies();
  const where = opts.file ? `${opts.file}: ` : "";
  const errors: string[] = [];
  const err = (id: string, why: string) => errors.push(`${where}${id}: ${why}`);

  let raw: { provider?: Provider; courses?: Record<string, unknown>[] };
  try {
    raw = parse(text) as typeof raw;
  } catch (e) {
    return { errors: [`${where}not valid YAML: ${(e as Error).message}`] };
  }
  const p = raw?.provider;
  if (
    !p ||
    !p.id ||
    !p.name ||
    !p.coursesUrl ||
    !Array.isArray(p.domains) ||
    p.domains.length === 0
  ) {
    return {
      errors: [`${where}provider needs id, name, coursesUrl and domains`],
    };
  }
  const providerDomains = p.domains.map((d) => d.toLowerCase());
  const linkOk = (url: string | undefined, allowCourseSeeker: boolean) => {
    if (!url) return true;
    const h = hostOf(url);
    if (!h) return false;
    return (
      onDomain(h, providerDomains) ||
      (allowCourseSeeker && onDomain(h, ["courseseeker.edu.au"]))
    );
  };
  const sourceOk = (url: string, id: string): boolean => {
    const h = hostOf(url);
    if (!h || !/^https?:/.test(url)) {
      err(id, `source URL "${url}" is not a web address`);
      return false;
    }
    for (const t of TAC) {
      if (onDomain(h, [t.host])) {
        const st = rightsFor(t.rights)?.status;
        if (st !== "cleared")
          err(
            id,
            `source on ${t.host} is not allowed while its rights status is "${st ?? "unregistered"}"`,
          );
        return false;
      }
    }
    if (!onDomain(h, providerDomains) && !onDomain(h, GOV_DOMAINS)) {
      err(
        id,
        `source ${h} is not on the provider's domain (${providerDomains.join(", ")}) or a listed government domain`,
      );
      return false;
    }
    return true;
  };

  const seen = new Set<string>();
  const courses: Course[] = [];
  for (const c of raw.courses ?? []) {
    const id = String(c.id ?? "");
    if (!id) {
      errors.push(`${where}a course has no id`);
      continue;
    }
    if (seen.has(id)) err(id, "duplicate course id");
    seen.add(id);
    const name = String(c.name ?? "");
    if (!name) err(id, "name is required");

    const figures: EntryFigure[] = [];
    for (const f of (c.entryFigures as Record<string, unknown>[] | undefined) ??
      []) {
      const fig = f as unknown as EntryFigure;
      if (!(FIGURE_KINDS as readonly string[]).includes(fig.kind))
        err(id, `unknown figure kind "${fig.kind}"`);
      if (typeof fig.value !== "number" || fig.value < 0 || fig.value > 99.95)
        err(id, `figure value ${fig.value} is outside 0 to 99.95`);
      if (
        !Number.isInteger(fig.intakeYear) ||
        fig.intakeYear < now.getUTCFullYear() - 3 ||
        fig.intakeYear > now.getUTCFullYear() + 2
      )
        err(
          id,
          `figure intake year ${fig.intakeYear} is not within the last three years or the next two`,
        );
      if (!ISO_DATE.test(String(fig.checkedOn)))
        err(id, "figure needs a checkedOn date (YYYY-MM-DD)");
      if (!fig.sourceUrl) err(id, "figure needs a sourceUrl");
      else sourceOk(fig.sourceUrl, id);
      figures.push({ ...fig, checkedOn: String(fig.checkedOn) });
    }

    const rawPre = c.prerequisites;
    const blocks = (
      Array.isArray(rawPre) ? rawPre : rawPre ? [rawPre] : []
    ) as PrerequisiteBlock[];
    const checkRule = (r: Rule): void => {
      if ("allOf" in r || "anyOf" in r) {
        for (const x of "allOf" in r ? r.allOf : r.anyOf) checkRule(x);
        return;
      }
      if (!isKnownStudyId(r.study, studies))
        err(id, `prerequisite names unknown study "${r.study}"`);
      if (r.minScore !== undefined && (r.minScore < 0 || r.minScore > 50))
        err(id, `minScore ${r.minScore} is outside 0 to 50`);
    };
    const prerequisites: PrerequisiteBlock[] = blocks.map((b) => {
      if (!b.text) err(id, "prerequisites need a text paraphrase");
      if (!Number.isInteger(b.appliesToYear))
        err(id, "prerequisites need appliesToYear");
      if (!ISO_DATE.test(String(b.checkedOn)))
        err(id, "prerequisites need a checkedOn date");
      if (!b.sourceUrl) err(id, "prerequisites need a sourceUrl");
      else sourceOk(b.sourceUrl, id);
      (b.rules ?? []).forEach(checkRule);
      return { ...b, rules: b.rules ?? [], checkedOn: String(b.checkedOn) };
    });

    const other: OtherCriterion[] = (
      (c.otherCriteria as OtherCriterion[] | undefined) ?? []
    ).map((o) => {
      if (!(CRITERION_KINDS as readonly string[]).includes(o.kind))
        err(id, `unknown criterion kind "${o.kind}"`);
      return o;
    });

    const summary = c.summary ? String(c.summary).trim() : undefined;
    const curated = !!summary || figures.length > 0 || prerequisites.length > 0;
    if (curated) {
      if (!summary) err(id, "a curated course needs a summary");
      else if (bannedIn(summary).length)
        err(id, "summary uses a banned phrase");
      else if (wordCount(summary) > 60)
        err(id, `summary is ${wordCount(summary)} words; the limit is 60`);
      if (!c.officialUrl) err(id, "a curated course needs an officialUrl");
      if (!c.checkedOn && figures.length === 0)
        err(id, "a curated course needs checkedOn");
    }
    const officialUrl = c.officialUrl ? String(c.officialUrl) : undefined;
    const courseSeekerUrl = c.courseSeekerUrl
      ? String(c.courseSeekerUrl)
      : undefined;
    if (!linkOk(officialUrl, false))
      err(
        id,
        `officialUrl is not on the provider's domain (${providerDomains.join(", ")})`,
      );
    if (
      courseSeekerUrl &&
      !onDomain(hostOf(courseSeekerUrl) ?? "", ["courseseeker.edu.au"])
    )
      err(id, "courseSeekerUrl must be on courseseeker.edu.au");

    const origin = c.origin === "gap_fill" ? "gap_fill" : "cricos";
    if (origin === "gap_fill" && !c.foundAt)
      err(id, "a gap_fill course needs foundAt (where it is listed)");
    if (origin === "cricos" && !c.cricosCode && !c.name)
      err(id, "a cricos course needs a cricosCode");

    courses.push({
      id,
      providerId: p.id,
      origin,
      depth: curated ? "curated" : "index_only",
      name,
      level: String(c.level ?? "bachelor"),
      fields: (c.fields as string[] | undefined) ?? [],
      campuses: (c.campuses as string[] | undefined) ?? [],
      ...(c.durationYears !== undefined
        ? { durationYears: Number(c.durationYears) }
        : {}),
      ...(c.cricosCode ? { cricosCode: String(c.cricosCode) } : {}),
      ...(c.vtacCode ? { vtacCode: String(c.vtacCode) } : {}),
      ...(officialUrl ? { officialUrl } : {}),
      ...(courseSeekerUrl ? { courseSeekerUrl } : {}),
      ...(c.foundAt ? { foundAt: String(c.foundAt) } : {}),
      ...(summary ? { summary } : {}),
      ...(c.checkedOn ? { checkedOn: String(c.checkedOn) } : {}),
      ...(c.checkedBy ? { checkedBy: String(c.checkedBy) } : {}),
      entryFigures: figures,
      prerequisites,
      otherCriteria: other,
    });
  }
  return { file: { provider: p, courses }, errors };
}
