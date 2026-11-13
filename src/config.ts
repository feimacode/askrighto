/** Settings read from the environment. Names follow Inkview's, with an ASKRIGHTO_ prefix. */

export const PUBLIC_URL = process.env.ASKRIGHTO_PUBLIC_URL?.trim() || "https://askrighto.com.au";

export interface HttpConfig {
  /** express.json limit, e.g. "256kb". */
  bodyLimit: string;
  /** Requests per window per client IP. 0 turns rate limiting off. */
  rateLimit: number;
  rateWindowMs: number;
  /** Trust X-Forwarded-For (set behind a load balancer or tunnel). */
  trustProxy: boolean;
  log: boolean;
  /** Header holding the real client IP, set by a trusted proxy (for example cf-connecting-ip). */
  clientIpHeader?: string;
  /** Host header allow-list (DNS rebinding protection) for public deployments. */
  allowedHosts?: string[];
}

export function httpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  const int = (v: string | undefined, d: number) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    bodyLimit: env.ASKRIGHTO_BODY_LIMIT || "256kb",
    rateLimit: int(env.ASKRIGHTO_RATE_LIMIT, 120),
    rateWindowMs: int(env.ASKRIGHTO_RATE_WINDOW_MS, 60_000),
    trustProxy: env.ASKRIGHTO_TRUST_PROXY === "1" || env.ASKRIGHTO_TRUST_PROXY === "true",
    log: env.ASKRIGHTO_LOG !== "off",
    clientIpHeader: env.ASKRIGHTO_CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
    allowedHosts: env.ASKRIGHTO_ALLOWED_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean),
  };
}
