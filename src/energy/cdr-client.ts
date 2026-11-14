/**
 * Client for the AER's Consumer Data Right energy product reference data API.
 *   List:   GET {base}/{retailer}/cds-au/v1/energy/plans          x-v: 1
 *   Detail: GET {base}/{retailer}/cds-au/v1/energy/plans/{planId} x-v: 3
 * No authentication. Every request goes through the per-retailer limiter.
 */
import { VERSION } from "../version.js";
import type { RetailerLimiter } from "./limiter.js";

export const DEFAULT_CDR_BASE = "https://cdr.energymadeeasy.gov.au";
const LIST_VERSION = "1";
const DETAIL_VERSION = "3";

export class CdrError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface RetailerStats {
  requests: number;
  throttled: number;
  failed: number;
  retried: number;
}

export interface CdrClientOptions {
  baseUrl?: string;
  limiter: RetailerLimiter;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Base backoff in ms when the response has no Retry-After. */
  backoffMs?: number;
  pageSize?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Called with every successful body, for recording fixtures. */
  recorder?: (rec: { kind: "list" | "detail"; retailer: string; key: string; body: unknown }) => void;
}

export type Effective = "CURRENT" | "FUTURE" | "ALL";

export class CdrClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly stats = new Map<string, RetailerStats>();
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly o: CdrClientOptions) {
    this.base = (o.baseUrl ?? DEFAULT_CDR_BASE).replace(/\/$/, "");
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  statsFor(slug: string): RetailerStats {
    let s = this.stats.get(slug);
    if (!s) {
      s = { requests: 0, throttled: 0, failed: 0, retried: 0 };
      this.stats.set(slug, s);
    }
    return s;
  }

  allStats(): Record<string, RetailerStats> {
    return Object.fromEntries(this.stats);
  }

  private plansUrl(slug: string): string {
    return `${this.base}/${encodeURIComponent(slug)}/cds-au/v1/energy/plans`;
  }

  private async get(slug: string, url: string, version: string): Promise<{ status: number; body: unknown }> {
    const max = this.o.maxRetries ?? 3;
    const st = this.statsFor(slug);
    for (let attempt = 0; ; attempt++) {
      let res: Response | undefined;
      let netErr: unknown;
      try {
        res = await this.o.limiter.run(slug, async () => {
          st.requests++;
          return this.fetchImpl(url, {
            headers: { "x-v": version, "x-min-v": version, accept: "application/json", "user-agent": `AskRighto/${VERSION}` },
            signal: AbortSignal.timeout(this.o.timeoutMs ?? 30_000),
          });
        });
      } catch (e) {
        netErr = e;
      }
      if (res && res.status === 404) return { status: 404, body: undefined };
      if (res && res.ok) return { status: res.status, body: await res.json() };

      const throttled = res?.status === 429;
      const retryable = !res || throttled || res.status >= 500;
      if (throttled) {
        st.throttled++;
        this.o.limiter.slowDown(slug);
      }
      if (!retryable || attempt >= max) {
        st.failed++;
        throw new CdrError(res ? `HTTP ${res.status} from ${slug}` : `Network error for ${slug}: ${(netErr as Error)?.message ?? "unknown"}`, res?.status);
      }
      st.retried++;
      const ra = Number(res?.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : (this.o.backoffMs ?? 1000) * 2 ** attempt;
      const jittered = wait + Math.random() * Math.min(wait, 250) * 0.5;
      this.o.limiter.holdOff(slug, jittered);
      await this.sleep(jittered);
    }
  }

  /** All list items for one retailer and effective filter, following `links.next` on the same host. */
  async listPlans(slug: string, effective: Effective): Promise<unknown[]> {
    const params = new URLSearchParams({ effective, fuelType: "ALL", type: "ALL", "page-size": String(this.o.pageSize ?? 100), page: "1" });
    let url: string | undefined = `${this.plansUrl(slug)}?${params}`;
    const out: unknown[] = [];
    let pages = 0;
    while (url) {
      if (++pages > 500) throw new CdrError(`Too many list pages for ${slug}`);
      const { body } = await this.get(slug, url, LIST_VERSION);
      const b = body as { data?: { plans?: unknown[] }; links?: { next?: string } } | undefined;
      if (!b?.data || !Array.isArray(b.data.plans)) throw new CdrError(`Unexpected list response from ${slug}`);
      this.o.recorder?.({ kind: "list", retailer: slug, key: `${effective}-p${pages}`, body });
      out.push(...b.data.plans);
      const next = b.links?.next;
      url = next && new URL(next, this.base).origin === new URL(this.base).origin ? new URL(next, this.base).toString() : undefined;
    }
    return out;
  }

  /** Plan detail, or undefined if the retailer no longer has the plan (404). */
  async getDetail(slug: string, planId: string): Promise<unknown | undefined> {
    const { status, body } = await this.get(slug, `${this.plansUrl(slug)}/${encodeURIComponent(planId)}`, DETAIL_VERSION);
    if (status === 404) return undefined;
    const data = (body as { data?: unknown } | undefined)?.data;
    if (!data) throw new CdrError(`Unexpected detail response from ${slug}`);
    this.o.recorder?.({ kind: "detail", retailer: slug, key: planId, body });
    return data;
  }
}
