/**
 * Client for lenders' CDR banking product reference data (no authentication):
 *   List:   GET {base}/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES
 *   Detail: GET {base}/cds-au/v1/banking/products/{productId}
 * The `x-v` values follow dsb-schema-tools 1.35.0 (list V5 with fallback to V4 and V3, detail V7) by analogy with the energy
 * endpoints. UNVERIFIED against live lenders: confirm them in the first recorded load
 * (add-home-loan-data task 1.2). Each lender is its own host, paced by its own limiter lane.
 */
import { CdrHttp, CdrError, type CdrHttpOptions, type RetailerStats } from "../cdr/http.js";
import type { Lender } from "./types.js";

/** Tried in order; a lender that answers 406 to one is retried with the next. Real lenders need 5 (8 of 12) or 4. */
export const LIST_VERSIONS = ["5", "4", "3"] as const;
export const DETAIL_VERSION = "7";

export interface BankingClientOptions extends CdrHttpOptions {
  pageSize?: number;
  recorder?: (rec: { kind: "list" | "detail"; lender: string; key: string; body: unknown }) => void;
}

export class BankingClient {
  private readonly http: CdrHttp;
  constructor(private readonly o: BankingClientOptions) {
    this.http = new CdrHttp(o);
  }
  statsFor(slug: string): RetailerStats {
    return this.http.statsFor(slug);
  }
  allStats(): Record<string, RetailerStats> {
    return this.http.allStats();
  }
  private productsUrl(l: Lender): string {
    return `${l.baseUri.replace(/\/$/, "")}/cds-au/v1/banking/products`;
  }
  private headers = (v: string) => ({ "x-v": v });

  private listVersion = new Map<string, string>();

  /** Asks for the newest list version, stepping down when the lender refuses it (HTTP 406). */
  private async getList(slug: string, url: string): Promise<{ body: unknown }> {
    const known = this.listVersion.get(slug);
    const order = known ? [known] : [...LIST_VERSIONS];
    let last: unknown;
    for (const v of order) {
      try {
        const r = await this.http.get(slug, url, { "x-v": v, "x-min-v": "1" });
        this.listVersion.set(slug, v);
        return r;
      } catch (e) {
        last = e;
        if ((e as CdrError).status !== 406) throw e;
      }
    }
    throw last;
  }

  /** Every list item for one lender, following `links.next` on the same host only. */
  async listProducts(l: Lender): Promise<unknown[]> {
    const params = new URLSearchParams({
      effective: "CURRENT",
      "product-category": "RESIDENTIAL_MORTGAGES",
      "page-size": String(this.o.pageSize ?? 100),
      page: "1",
    });
    let url: string | undefined = `${this.productsUrl(l)}?${params}`;
    const origin = new URL(l.baseUri).origin;
    const out: unknown[] = [];
    let pages = 0;
    while (url) {
      if (++pages > 200) throw new CdrError(`Too many list pages for ${l.slug}`);
      const { body } = await this.getList(l.slug, url);
      const b = body as { data?: { products?: unknown[] }; links?: { next?: string } } | undefined;
      if (!b?.data || !Array.isArray(b.data.products))
        throw new CdrError(`Unexpected list response from ${l.slug}`);
      this.o.recorder?.({ kind: "list", lender: l.slug, key: `p${pages}`, body });
      out.push(...b.data.products);
      const next = b.links?.next;
      url = next && new URL(next, l.baseUri).origin === origin ? new URL(next, l.baseUri).toString() : undefined;
    }
    return out;
  }

  /** Product detail, or undefined if the lender no longer has it (404). */
  async getDetail(l: Lender, productId: string): Promise<unknown | undefined> {
    const { status, body } = await this.http.get(
      l.slug,
      `${this.productsUrl(l)}/${encodeURIComponent(productId)}`,
      this.headers(DETAIL_VERSION),
    );
    if (status === 404) return undefined;
    const data = (body as { data?: unknown } | undefined)?.data;
    if (!data) throw new CdrError(`Unexpected detail response from ${l.slug}`);
    this.o.recorder?.({ kind: "detail", lender: l.slug, key: productId, body });
    return data;
  }
}
