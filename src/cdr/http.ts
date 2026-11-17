/**
 * Shared HTTP core for Consumer Data Right product data clients (energy plans, home loans).
 * Every request goes through a per-host limiter, honours `Retry-After`, retries 5xx and network
 * errors with backoff, treats 404 as "gone", and counts requests per host for the sync report.
 */
import { VERSION } from "../version.js";
import type { RetailerLimiter } from "./limiter.js";

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

export interface CdrHttpOptions {
  limiter: RetailerLimiter;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Base backoff in ms when the response has no Retry-After. */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class CdrHttp {
  private readonly fetchImpl: typeof fetch;
  private readonly stats = new Map<string, RetailerStats>();
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly o: CdrHttpOptions) {
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

  async get(
    slug: string,
    url: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: unknown }> {
    const max = this.o.maxRetries ?? 3;
    const st = this.statsFor(slug);
    for (let attempt = 0; ; attempt++) {
      let res: Response | undefined;
      let netErr: unknown;
      try {
        res = await this.o.limiter.run(slug, async () => {
          st.requests++;
          return this.fetchImpl(url, {
            headers: {
              ...headers,
              accept: "application/json",
              "user-agent": `AskRighto/${VERSION}`,
            },
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
        throw new CdrError(
          res
            ? `HTTP ${res.status} from ${slug}`
            : `Network error for ${slug}: ${(netErr as Error)?.message ?? "unknown"}`,
          res?.status,
        );
      }
      st.retried++;
      const ra = Number(res?.headers.get("retry-after"));
      const wait =
        Number.isFinite(ra) && ra > 0
          ? ra * 1000
          : (this.o.backoffMs ?? 1000) * 2 ** attempt;
      const jittered = wait + Math.random() * Math.min(wait, 250) * 0.5;
      this.o.limiter.holdOff(slug, jittered);
      await this.sleep(jittered);
    }
  }
}
