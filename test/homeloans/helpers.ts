/** Synthetic CDR banking payloads (shapes from dsb-schema-tools 1.35.0) and a mock lender server. */
import { createServer, type Server } from "node:http";

export interface MockProduct {
  detail: Record<string, any>;
  list?: Record<string, any>;
}

export function rate(over: Record<string, any> = {}) {
  return {
    lendingRateType: "VARIABLE",
    rate: "0.0599",
    comparisonRate: "0.0612",
    applicationType: "PERIODIC",
    repaymentType: "PRINCIPAL_AND_INTEREST",
    loanPurpose: "OWNER_OCCUPIED",
    ...over,
  };
}

export function product(id: string, over: Record<string, any> = {}): Record<string, any> {
  return {
    productId: id,
    name: `Home Loan ${id}`,
    description: "A home loan",
    brand: "testbank",
    brandName: "Test Bank",
    lastUpdated: "2026-11-01T00:00:00Z",
    isTailored: false,
    productCategory: "RESIDENTIAL_MORTGAGES",
    applicationUri: "https://testbank.example/apply",
    additionalInformation: { overviewUri: `https://testbank.example/home-loans/${id}` },
    lendingRates: [rate()],
    fees: [{ name: "Application fee", feeType: "UPFRONT", feeMethodUType: "fixedAmount", fixedAmount: { amount: "395.00" } }],
    features: [{ featureType: "OFFSET" }, { featureType: "REDRAW" }],
    constraints: [{ constraintType: "MAX_LVR", additionalValue: "0.95" }],
    eligibility: [],
    ...over,
  };
}

export interface MockLenders {
  url: string;
  server: Server;
  log: Array<{ slug: string; path: string; v: string | undefined }>;
  state: Record<string, MockProduct[]>;
  fail: Set<string>;
  close(): Promise<void>;
}

export async function startMockLenders(state: Record<string, MockProduct[]>): Promise<MockLenders> {
  const log: MockLenders["log"] = [];
  const fail = new Set<string>();
  const server = createServer((req, res) => {
    const u = new URL(req.url!, "http://x");
    const m = /^\/([^/]+)\/cds-au\/v1\/banking\/products(?:\/(.+))?$/.exec(u.pathname);
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (!m) return send(404);
    const slug = decodeURIComponent(m[1]!);
    log.push({ slug, path: u.pathname + u.search, v: req.headers["x-v"] as string | undefined });
    if (fail.has(slug)) return send(500, { error: "down" });
    const items = state[slug];
    if (!items) return send(404);
    if (m[2]) {
      const p = items.find((x) => x.detail.productId === decodeURIComponent(m[2]!));
      return p ? send(200, { data: p.detail }) : send(404);
    }
    const list = items.map((p) => ({
      productId: p.detail.productId,
      name: p.detail.name,
      brand: p.detail.brand,
      lastUpdated: p.detail.lastUpdated,
      isTailored: p.detail.isTailored,
      productCategory: p.detail.productCategory,
      ...p.list,
    }));
    send(200, { data: { products: list }, links: { self: "x" }, meta: { totalRecords: list.length, totalPages: 1 } });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    log,
    state,
    fail,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
