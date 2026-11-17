/**
 * Client for the AER's Consumer Data Right energy product reference data API.
 *   List:   GET {base}/{retailer}/cds-au/v1/energy/plans          x-v: 1
 *   Detail: GET {base}/{retailer}/cds-au/v1/energy/plans/{planId} x-v: 3
 * No authentication. Every request goes through the per-retailer limiter.
 */
import { CdrHttp, CdrError, type CdrHttpOptions, type RetailerStats } from "../cdr/http.js";

export { CdrError, type RetailerStats };

export const DEFAULT_CDR_BASE = "https://cdr.energymadeeasy.gov.au";
const LIST_VERSION = "1";
const DETAIL_VERSION = "3";

export interface CdrClientOptions extends CdrHttpOptions {
  baseUrl?: string;
  pageSize?: number;
  /** Called with every successful body, for recording fixtures. */
  recorder?: (rec: {
    kind: "list" | "detail";
    retailer: string;
    key: string;
    body: unknown;
  }) => void;
}

export type Effective = "CURRENT" | "FUTURE" | "ALL";

export class CdrClient {
  private readonly base: string;
  private readonly http: CdrHttp;

  constructor(private readonly o: CdrClientOptions) {
    this.base = (o.baseUrl ?? DEFAULT_CDR_BASE).replace(/\/$/, "");
    this.http = new CdrHttp(o);
  }

  statsFor(slug: string): RetailerStats {
    return this.http.statsFor(slug);
  }

  allStats(): Record<string, RetailerStats> {
    return this.http.allStats();
  }

  private plansUrl(slug: string): string {
    return `${this.base}/${encodeURIComponent(slug)}/cds-au/v1/energy/plans`;
  }

  private get(slug: string, url: string, version: string) {
    return this.http.get(slug, url, { "x-v": version, "x-min-v": version });
  }

  /** All list items for one retailer and effective filter, following `links.next` on the same host. */
  async listPlans(slug: string, effective: Effective): Promise<unknown[]> {
    const params = new URLSearchParams({
      effective,
      fuelType: "ALL",
      type: "ALL",
      "page-size": String(this.o.pageSize ?? 100),
      page: "1",
    });
    let url: string | undefined = `${this.plansUrl(slug)}?${params}`;
    const out: unknown[] = [];
    let pages = 0;
    while (url) {
      if (++pages > 500) throw new CdrError(`Too many list pages for ${slug}`);
      const { body } = await this.get(slug, url, LIST_VERSION);
      const b = body as
        | { data?: { plans?: unknown[] }; links?: { next?: string } }
        | undefined;
      if (!b?.data || !Array.isArray(b.data.plans))
        throw new CdrError(`Unexpected list response from ${slug}`);
      this.o.recorder?.({
        kind: "list",
        retailer: slug,
        key: `${effective}-p${pages}`,
        body,
      });
      out.push(...b.data.plans);
      const next = b.links?.next;
      url =
        next && new URL(next, this.base).origin === new URL(this.base).origin
          ? new URL(next, this.base).toString()
          : undefined;
    }
    return out;
  }

  /** Plan detail, or undefined if the retailer no longer has the plan (404). */
  async getDetail(slug: string, planId: string): Promise<unknown | undefined> {
    const { status, body } = await this.get(
      slug,
      `${this.plansUrl(slug)}/${encodeURIComponent(planId)}`,
      DETAIL_VERSION,
    );
    if (status === 404) return undefined;
    const data = (body as { data?: unknown } | undefined)?.data;
    if (!data) throw new CdrError(`Unexpected detail response from ${slug}`);
    this.o.recorder?.({ kind: "detail", retailer: slug, key: planId, body });
    return data;
  }
}
