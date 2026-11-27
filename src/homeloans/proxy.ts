/**
 * Live relay of lenders' CDR home loan product data (add-cdr-home-loan-proxy). Nothing from a lender is stored,
 * cached or logged; only the Register brand list is held in memory. Requests have a fixed shape: the two CDR product
 * paths on a base URI that came from the Register, with our own headers. No caller URL or header reaches a lender.
 */
import { RetailerLimiter } from "../cdr/limiter.js";
import { VERSION } from "../version.js";

export const REGISTER_BRANDS_URL =
  "https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary";
const LIST_VERSIONS = [5, 4, 3] as const;
const DETAIL_VERSIONS = [7, 6, 5] as const;
const BRANDS_TTL_MS = 6 * 3600_000;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;
export const MAX_PAGE_SIZE = 25;
const PRODUCT_ID = /^[A-Za-z0-9._~:-]{1,128}$/;

export interface LenderBrand {
  id: string;
  name: string;
  baseUri: string;
}

export type ProxyErrorKind =
  | "register_unavailable"
  | "lender_unreachable"
  | "version_unsupported"
  | "bad_response"
  | "too_large";

export class ProxyError extends Error {
  constructor(
    readonly kind: ProxyErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface ProxyResult {
  endpoint: string;
  xVersion: number;
  fetchedAt: string;
  /** The lender's JSON, as sent. */
  body: unknown;
}

/** Returns the base URI without a trailing slash if it is safe to call, otherwise undefined. */
export function safeBaseUri(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    return undefined;
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return undefined; // dotted DNS name; no IPv6 literal
  if (
    /^\d+(\.\d+){3}$/.test(h) ||
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  )
    return undefined;
  if (u.search || u.hash) return undefined;
  return `https://${h}${u.pathname.replace(/\/+$/, "")}`;
}

export function parseBrands(body: unknown): LenderBrand[] {
  const rows = (body as { data?: unknown })?.data;
  if (!Array.isArray(rows))
    throw new ProxyError(
      "register_unavailable",
      "The CDR Register answered in an unexpected shape.",
    );
  const out: LenderBrand[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const industries = r.industries;
    if (
      Array.isArray(industries) &&
      !industries
        .map(String)
        .map((x) => x.toLowerCase())
        .includes("banking")
    )
      continue;
    const base = safeBaseUri(r.publicBaseUri);
    const id =
      typeof r.dataHolderBrandId === "string" ? r.dataHolderBrandId : undefined;
    const name = typeof r.brandName === "string" ? r.brandName : undefined;
    if (!base || !id || !name) continue;
    out.push({ id, name, baseUri: base });
  }
  return out;
}

export interface ProxyOptions {
  fetchImpl?: typeof fetch;
  limiter?: RetailerLimiter;
  now?: () => number;
}

export class CdrProxy {
  private readonly fetchImpl: typeof fetch;
  private readonly limiter: RetailerLimiter;
  private readonly now: () => number;
  private brandCache: { at: number; brands: LenderBrand[] } | undefined;

  constructor(o: ProxyOptions = {}) {
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.limiter = o.limiter ?? new RetailerLimiter({ rps: 2, maxInFlight: 8 });
    this.now = o.now ?? Date.now;
  }

  private headers(v: number): Record<string, string> {
    return {
      accept: "application/json",
      "x-v": String(v),
      "x-min-v": "1",
      "user-agent": `AskRighto/${VERSION} (+https://askrighto.feimacode.com)`,
    };
  }

  private async get(host: string, url: string, v: number) {
    let res: Response;
    try {
      res = await this.limiter.run(host, () =>
        this.fetchImpl(url, {
          headers: this.headers(v),
          redirect: "error",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
      );
    } catch {
      throw new ProxyError(
        "lender_unreachable",
        "The server could not be reached or took too long to answer.",
      );
    }
    const text = await res.text();
    if (text.length > MAX_BYTES)
      throw new ProxyError(
        "too_large",
        "The response was larger than Ask Righto relays.",
        res.status,
      );
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { status: res.status, body };
  }

  async brands(): Promise<LenderBrand[]> {
    if (this.brandCache && this.now() - this.brandCache.at < BRANDS_TTL_MS)
      return this.brandCache.brands;
    let r;
    try {
      r = await this.get("register", REGISTER_BRANDS_URL, 2);
    } catch (e) {
      throw new ProxyError(
        "register_unavailable",
        `The CDR Register could not be read: ${(e as Error).message}`,
      );
    }
    if (r.status !== 200)
      throw new ProxyError(
        "register_unavailable",
        `The CDR Register answered ${r.status}.`,
        r.status,
      );
    const brands = parseBrands(r.body);
    this.brandCache = { at: this.now(), brands };
    return brands;
  }

  private async negotiate(
    brand: LenderBrand,
    url: string,
    versions: readonly number[],
  ): Promise<ProxyResult> {
    const host = new URL(brand.baseUri).hostname;
    let last = 0;
    for (const v of versions) {
      const r = await this.get(host, url, v);
      if (r.status === 200) {
        const data = (r.body as { data?: unknown } | undefined)?.data;
        if (!data || typeof data !== "object")
          throw new ProxyError(
            "bad_response",
            "The lender answered 200 but not with CDR data.",
            200,
          );
        return {
          endpoint: url,
          xVersion: v,
          fetchedAt: new Date(this.now()).toISOString(),
          body: r.body,
        };
      }
      last = r.status;
      if (r.status !== 406) break;
    }
    if (last === 406)
      throw new ProxyError(
        "version_unsupported",
        "The lender rejected every version tried.",
        406,
      );
    throw new ProxyError("bad_response", `The lender answered ${last}.`, last);
  }

  list(
    brand: LenderBrand,
    page: number,
    pageSize: number,
  ): Promise<ProxyResult> {
    const size = Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE);
    const p = Math.max(1, Math.floor(page));
    const url = `${brand.baseUri}/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES&page=${p}&page-size=${size}`;
    return this.negotiate(brand, url, LIST_VERSIONS);
  }

  detail(brand: LenderBrand, productId: string): Promise<ProxyResult> {
    if (!PRODUCT_ID.test(productId))
      throw new ProxyError("bad_response", "That is not a valid product id.");
    const url = `${brand.baseUri}/cds-au/v1/banking/products/${encodeURIComponent(productId)}`;
    return this.negotiate(brand, url, DETAIL_VERSIONS);
  }
}

let shared: CdrProxy | undefined;
export const getCdrProxy = (): CdrProxy => (shared ??= new CdrProxy());
/** For tests: install a proxy with a mock fetch. */
export function setCdrProxy(p: CdrProxy | undefined): void {
  shared = p;
}

/** Resolves a lender by brand id, or by a name matching exactly one brand. */
export function resolveLender(
  brands: readonly LenderBrand[],
  q: string,
): { ok: true; brand: LenderBrand } | { ok: false; candidates: LenderBrand[] } {
  const n = q.trim().toLowerCase();
  const byId = brands.find((b) => b.id.toLowerCase() === n);
  if (byId) return { ok: true, brand: byId };
  const exact = brands.filter((b) => b.name.toLowerCase() === n);
  if (exact.length === 1) return { ok: true, brand: exact[0]! };
  const part = brands.filter((b) => b.name.toLowerCase().includes(n));
  if (part.length === 1) return { ok: true, brand: part[0]! };
  return { ok: false, candidates: (part.length ? part : exact).slice(0, 10) };
}
