/** Course model: a CRICOS index row plus the provider it belongs to. No entry figures or prerequisites are stored. */

export const REGIONS = ["vic", "nsw-act", "qld"] as const;
export type Region = (typeof REGIONS)[number];

export interface Provider {
  id: string;
  name: string;
  coursesUrl: string;
  /** Domains the provider's own pages live on. */
  domains: string[];
  /** CRICOS provider code, used to pick this provider's rows from the CRICOS file. */
  cricosProviderCode?: string;
  /** The provider's course search link, given when a course is not in the index. */
  searchUrl?: string;
  /** Region folder the provider file lives in; set by the loader from the folder. */
  region?: Region;
  /** States whose admissions system lists this provider, when the region folder is not enough (nsw-act covers NSW and the ACT). */
  states?: ("vic" | "nsw" | "act" | "qld")[];
}

export interface Course {
  id: string;
  providerId: string;
  name: string;
  level: string;
  campuses: string[];
  durationYears?: number;
  cricosCode: string;
}

export interface ProviderFile {
  provider: Provider;
}
