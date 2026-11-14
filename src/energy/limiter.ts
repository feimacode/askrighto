/**
 * Per-retailer request pacing. Each retailer is its own server with its own limits, so:
 * at most `rps` requests a second and one in flight to any one retailer, plus an overall
 * ceiling on requests in flight. A throttled retailer slows only itself.
 */
export interface LimiterOptions {
  rps: number;
  maxInFlight: number;
  minRps?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface Lane {
  rps: number;
  nextAt: number;
  tail: Promise<void>;
}

export class RetailerLimiter {
  private lanes = new Map<string, Lane>();
  private inFlight = 0;
  private waiting: Array<() => void> = [];
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly minRps: number;

  constructor(private readonly opts: LimiterOptions) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.minRps = opts.minRps ?? 0.1;
  }

  private lane(slug: string): Lane {
    let l = this.lanes.get(slug);
    if (!l) {
      l = { rps: this.opts.rps, nextAt: 0, tail: Promise.resolve() };
      this.lanes.set(slug, l);
    }
    return l;
  }

  rateOf(slug: string): number {
    return this.lane(slug).rps;
  }

  /** Halves a retailer's rate, down to the floor; other retailers are unaffected. */
  slowDown(slug: string): void {
    const l = this.lane(slug);
    l.rps = Math.max(this.minRps, l.rps / 2);
  }

  /** Delays that retailer's next request until at least `ms` from now. */
  holdOff(slug: string, ms: number): void {
    const l = this.lane(slug);
    l.nextAt = Math.max(l.nextAt, this.now() + ms);
  }

  private async acquire(): Promise<void> {
    if (this.inFlight < this.opts.maxInFlight) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((r) => this.waiting.push(r));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.inFlight--;
  }

  /** Runs `fn` for this retailer once its turn comes. Requests to one retailer run one at a time. */
  run<T>(slug: string, fn: () => Promise<T>): Promise<T> {
    const l = this.lane(slug);
    const result = l.tail.then(async () => {
      const wait = l.nextAt - this.now();
      if (wait > 0) await this.sleep(wait);
      await this.acquire();
      try {
        // Reserve the slot at start, so spacing counts from when the request began.
        l.nextAt = Math.max(this.now(), l.nextAt) + 1000 / l.rps;
        return await fn();
      } finally {
        this.release();
      }
    });
    l.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
