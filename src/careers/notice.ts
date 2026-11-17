/** Fixed wording for career outcomes results. */
export const CAREER_NOTICE =
  "Ask Righto is a free information tool. Figures are Jobs and Skills Australia's published employment projections, which are indicative and do not reflect every change in the labour market. They are not advice about what to study or which job to take.";

export const CAREER_CAPTION =
  "Free information tool. Jobs and Skills Australia projections are indicative, not advice about what to study or do.";

export const CAREER_SOURCE = {
  name: "Jobs and Skills Australia, Employment Projections",
  url: "https://www.jobsandskills.gov.au/data/employment-projections",
  licence: "CC BY 4.0",
} as const;

export const CAREER_NOT_COVERED =
  "Not covered: pay or salary, job vacancies, visa or migration advice, and which course or field of study leads to an occupation.";

/** The official page a person can use for what the tools do not hold. */
export const CAREER_OFFICIAL_URL = "https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles";

/** Words career results never use to steer a decision. */
export const CAREER_BANNED: readonly RegExp[] = [/\bbest\b/i, /right for you/i, /\bshould\b/i, /\brecommend/i, /safe (job|career)/i, /guaranteed/i, /great (job|career)/i];
export const bannedInCareer = (text: string): string[] => CAREER_BANNED.flatMap((re) => text.match(re)?.[0] ?? []);
