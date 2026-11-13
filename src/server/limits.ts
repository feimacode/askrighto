/**
 * Abuse limits and logging for HTTP mode. Pure helpers so unit tests can drive them.
 * Nothing here reads tool arguments: logs hold method, tool name, status and timing only.
 */

/** Fixed-window counter per key. Memory is bounded by sweeping expired windows. */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Returns 0 when allowed, else seconds until the window resets. */
  take(key: string): number {
    if (this.limit <= 0) return 0;
    const t = this.now();
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
    let e = this.hits.get(key);
    if (!e || e.reset <= t) {
      e = { count: 0, reset: t + this.windowMs };
      this.hits.set(key, e);
    }
    e.count++;
    return e.count > this.limit ? Math.max(1, Math.ceil((e.reset - t) / 1000)) : 0;
  }
}

/** Rate-limit key: the trusted proxy's client IP header when configured, else the socket / X-Forwarded-For IP. */
export function clientKey(headers: Record<string, string | string[] | undefined>, ip: string | undefined, header?: string): string {
  if (header) {
    const v = headers[header];
    const first = (Array.isArray(v) ? v[0] : v)?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return ip ?? "unknown";
}

/** The only request facts that may be logged: JSON-RPC method and, for tools/call, the tool name. */
export function describeRpc(body: unknown): { rpc?: string; tool?: string } {
  const one = Array.isArray(body) ? body[0] : body;
  if (!one || typeof one !== "object") return {};
  const o = one as Record<string, unknown>;
  const rpc = typeof o.method === "string" ? o.method.slice(0, 60) : undefined;
  const params = o.params as Record<string, unknown> | undefined;
  const tool = rpc === "tools/call" && typeof params?.name === "string" && /^[\w.-]{1,64}$/.test(params.name) ? params.name : undefined;
  return { rpc, tool };
}

export function logLine(f: { method: string; path: string; status: number; ms: number; rpc?: string; tool?: string }): string {
  return JSON.stringify({ t: new Date().toISOString(), ...f });
}
